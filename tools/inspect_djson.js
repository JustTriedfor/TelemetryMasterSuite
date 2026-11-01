// Read-only structural inspection of a .djson file. Does not execute anything inside it.
var fs=require('fs');
var p=process.argv[2];
var j=JSON.parse(fs.readFileSync(p,'utf8'));
function keys(o){return o&&typeof o==='object'?Object.keys(o):[];}
console.log('TOP KEYS:',keys(j).join(', '));
var scr=j.Screens||[];
console.log('Screens:',scr.length);
scr.forEach(function(s,i){
  console.log(' screen',i,'keys:',keys(s).join(','));
  console.log('   Name:',s.Name,'W/H:',s.Width,s.Height,'items:',(s.Items||[]).length, 'ScreenId', s.ScreenId);
});
var stats={types:{},props:{},formulas:0,jsFormulas:0};
var propRe=/\$prop\(\s*['"]([^'"]+)['"]/g, pr2=/\b(?:\$prop|property|getProperty)\(['"]([^'"]+)['"]/g;
var seen={};
function walk(o,path){
  if(o&&typeof o==='object'){
    if(o['$type']){var t=o['$type'].split(',')[0];stats.types[t]=(stats.types[t]||0)+1;}
    for(var k in o){
      var v=o[k];
      if(typeof v==='string'){
        if(k==='Expression'||k==='JSExt'||k==='Formula'||/Binding/i.test(k)){}
        var m;propRe.lastIndex=0;
        while((m=propRe.exec(v))){seen[m[1]]=(seen[m[1]]||0)+1;}
      } else walk(v,path+'/'+k);
    }
  }
}
walk(j,'');
var top=Object.keys(stats.types).sort(function(a,b){return stats.types[b]-stats.types[a]}).slice(0,40);
console.log('TOP $types:');top.forEach(function(t){console.log('  ',stats.types[t],t)});
var pk=Object.keys(seen).sort(function(a,b){return seen[b]-seen[a]});
console.log('distinct $prop names:',pk.length);
fs.writeFileSync(process.argv[3]||'props.json',JSON.stringify(seen,null,1));
