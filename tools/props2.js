var fs=require('fs');
var files=process.argv.slice(2);
var br={},pp={},interp={},js=0,nc=0;
files.forEach(function(f){
  if(/\.djson$/.test(f)){
    var j=JSON.parse(fs.readFileSync(f,'utf8'));
    (function walk(o){
      if(o&&typeof o==='object'){
        if(o.Expression!==undefined&&typeof o.Expression==='string'){
          var k=(o.JSExt?'JSExt':'NCalc')+'/Interp'+o.Interpreter; interp[k]=(interp[k]||0)+1;
          scan(o.Expression);
        }
        for(var k in o)walk(o[k]);
      }
    })(j);
  } else scan(fs.readFileSync(f,'utf8'));
});
function scan(s){
  var m,r=/\[([A-Za-z][A-Za-z0-9_.\-]*)\]/g;
  while((m=r.exec(s)))br[m[1]]=(br[m[1]]||0)+1;
  r=/\$prop\(\s*['"]([^'"]+)['"]/g;
  while((m=r.exec(s)))pp[m[1]]=(pp[m[1]]||0)+1;
}
console.log('formula engines:',JSON.stringify(interp));
console.log('--- [bracket] props ('+Object.keys(br).length+')');console.log(Object.keys(br).sort().join('\n'));
console.log('--- $prop() props ('+Object.keys(pp).length+')');console.log(Object.keys(pp).sort().join('\n'));
