// Simulated SimHub properties for one frame of the mock lap (mock/sim.js), shared by the build validator and the identity test.
var POS = ['FrontLeft', 'FrontRight', 'RearLeft', 'RearRight'];
function props(f, game) {
  var P = 'DataCorePlugin.GameRawData.Physics.', G = 'DataCorePlugin.GameData.', p = {}, i, n;
  p['DataCorePlugin.CurrentGame'] = game === 'ac' ? 'AssettoCorsa' : 'AssettoCorsaCompetizione'; p['TemperatureUnit'] = 'Celsius';
  p[G + 'Throttle'] = f.throttle * 100; p[G + 'Brake'] = f.brake * 100; p[G + 'Clutch'] = 0; p[G + 'Gear'] = String(f.gear); p[G + 'SpeedKmh'] = f.speed * 3.6; p[G + 'Rpms'] = f.rpm; p[G + 'MaxRpm'] = f.maxRpm;
  p[G + 'ABSActive'] = f.absActive; p[G + 'TCActive'] = f.tcActive; p[G + 'OrientationYawVelocity'] = f.yawRate; p[G + 'DeltaToSessionBest'] = 0.355; p[G + 'CurrentLapTime'] = f.lapT; p[G + 'BestLapTime'] = 60.62; p[G + 'LastLapTime'] = 61.4;
  p[G + 'CurrentLap'] = f.lap; p[G + 'CompletedLaps'] = f.lap - 1; p[G + 'TotalLaps'] = 34; p[G + 'RemainingLaps'] = 34 - f.lap + 1; p[G + 'Fuel'] = f.fuel; p[G + 'OilTemperature'] = f.oilTemp; p[G + 'WaterTemperature'] = f.waterTemp; p[G + 'Position'] = 4;
  p[G + 'CarId'] = 'mock'; p[G + 'SessionTimeLeft'] = 1774; p[G + 'RoadTemperature'] = 38; p[G + 'AirTemperature'] = 24; p[G + 'Flag_Name'] = ''; p[G + 'BrakeBias'] = 57.5;
  p['DataCorePlugin.Computed.Fuel_LitersPerLap'] = 2.41; p['DataCorePlugin.Computed.Fuel_RemainingLaps'] = f.fuel / 2.41;
  p['DataCorePlugin.GameRawData.Graphics.gapAhead'] = 2200; p['DataCorePlugin.GameRawData.Graphics.gapBehind'] = 2600;
  p[G + 'Sector1Time'] = 20.0; p[G + 'Sector2Time'] = 20.2; p[G + 'Sector3LastLapTime'] = 20.4; p[G + 'Sector1BestTime'] = 19.9; p[G + 'Sector2BestTime'] = 20.2; p[G + 'Sector3BestLapTime'] = 20.4;
  if (game === 'ac') { var h = f.beta_true + 0.3, th = h + f.beta_true * 0; p[P + 'Velocity01'] = Math.sin(h - f.beta_true) * f.speed; p[P + 'Velocity02'] = 0; p[P + 'Velocity03'] = Math.cos(h - f.beta_true) * f.speed; p[P + 'Heading'] = h; }
  else { p[P + 'LocalVelocity01'] = f.vel[0]; p[P + 'LocalVelocity02'] = f.vel[1]; p[P + 'LocalVelocity03'] = f.vel[2]; }
  p[P + 'AccG01'] = f.latG; p[P + 'AccG03'] = f.longG; p[P + 'SteerAngle'] = f.steer / 0.45; p[P + 'Pitch'] = f.pitch; p[P + 'Roll'] = f.roll; p[P + 'Turbo'] = f.turbo;
  for (i = 0; i < 4; i++) { n = '0' + (i + 1);
    if (game !== 'ac') { p[P + 'SlipAngle' + n] = f.slipAngle[i]; p[P + 'SlipRatio' + n] = f.slipRatio[i]; p[P + 'padLife' + n] = f.brakePad[i]; p[P + 'discLife' + n] = f.brakeDisc[i]; }
    p[P + 'WheelSlip' + n] = f.slipCombined[i]; p[P + 'WheelLoad' + n] = f.tyreLoad[i]; p[P + 'SuspensionTravel' + n] = f.suspTravel[i]; p[P + 'TyreCoreTemperature' + n] = f.tyreCore[i]; p[P + 'BrakeTemp' + n] = f.brakeTemp[i];
    p[G + 'TyrePressure' + POS[i]] = f.tyrePressure[i]; p[G + 'TyreWear' + POS[i]] = f.tyreWear[i]; p[G + 'TyreTemperature' + POS[i] + 'Inner'] = f.tyreInner[i]; p[G + 'TyreTemperature' + POS[i] + 'Middle'] = f.tyreMid[i]; p[G + 'TyreTemperature' + POS[i] + 'Outer'] = f.tyreOuter[i]; }
  var u = Math.min(0.9999, f.lapT / 61), a = 2 * Math.PI * u, PT = 'PersistantTrackerPlugin.';      // a 61 s lap round a closed loop, three sectors, five previous laps
  p['DataCorePlugin.GameRawData.Graphics.NormalizedCarPosition'] = u; p[G + 'CarCoordinates01'] = 420 * Math.cos(a) + 120 * Math.cos(2 * a); p[G + 'CarCoordinates03'] = 260 * Math.sin(a) + 90 * Math.sin(3 * a);
  p[G + 'CurrentSectorIndex'] = Math.min(2, Math.floor(u * 3)); p[G + 'LastSectorTime'] = 20.2;
  for (i = 0; i < 5; i++) { p[PT + 'PreviousLap_0' + i] = 61.2 + i * 0.37; p[PT + 'PreviousLap_0' + i + '_DeltaToSessionBest'] = i === 2 ? 0 : 0.58 + i * 0.37; }
  for (i = 0; i < 4; i++) { p[P + 'WheelAngularSpeed0' + (i + 1)] = f.speed / 0.33 * (1 + (f.slipRatio ? f.slipRatio[i] : 0)); }
  if (game === 'ac') {       // what the real AC probe showed: no session-best delta and no current-lap sector times
    delete p[G + 'DeltaToSessionBest']; delete p[G + 'Sector1Time']; delete p[G + 'Sector2Time']; delete p[G + 'Sector3LastLapTime']; p[PT + 'SessionBestLiveDeltaSeconds'] = 0.355;
    p[G + 'SessionTimeLeft'] = -517; delete p['DataCorePlugin.GameRawData.Graphics.gapAhead']; delete p['DataCorePlugin.GameRawData.Graphics.gapBehind']; p[G + 'OilTemperature'] = 0; p[G + 'WaterTemperature'] = 0;
  }
  return p;
}
module.exports = props;
