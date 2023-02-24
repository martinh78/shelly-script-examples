 // this script logs the power consumption on a sehlly 1PM/2PM device. 
 // It was written to monitor solar power production, hence the time limit to 5am - 9pm
 // My solar inverter is limited to 560W max. output and so is the generated graph
 // Start the script and open http://<shelly address>/script/<script id>/solar in your browser
 
 let config = {
  interval: 300,
  reset: 02,
  solarTime: {begin: 6, end: 21},
  lineWidth: 5,
};
let energy = {total: 0, morning: 0, perDay: []};
let power = {current: 0, intervals: []};
let resetDone = false;

function reset(){
  let compSolar = Shelly.getComponentStatus("switch:0");
  energy.morning = compSolar.aenergy.total;
  energy.total = 0;
  power.intervals = [];
}

function shiftEnergyPerDay() {
  energy.perDay.push(energy.total);
  if (energy.perDay.length > 3) {
    energy.perDay.splice(0,1);
  }
}

function getTime(){
  let sys = Shelly.getComponentStatus("sys");
  return sys.time.slice(0,5);
}

function getHours(){
  return JSON.parse(getTime().slice(0,2));
}

function resetAtNight() {
  if (getHours() === config.reset) {
    if (!resetDone) { 
      shiftEnergyPerDay();  
      reset();
      resetDone = true;
    }
  }
  else {      
    resetDone = false;
  }
}

function isDaytime(){
  let hours = getHours();
  return (hours > config.solarTime.begin && hours <= config.solarTime.end);
}

function getSolarPower() {
  resetAtNight();
  let compSolar = Shelly.getComponentStatus("switch:0");
  let newEnergy = compSolar.aenergy.total - energy.morning - energy.total;
  energy.total = compSolar.aenergy.total - energy.morning;
  power.current = newEnergy * 3600 / config.interval;
  if (isDaytime()) {
    power.intervals.push({time: getTime(), power: power.current});
  }
}

function printNum(value) {
  return JSON.stringify(Math.round(value));
}

function getStyle() {
  let width = printNum((config.solarTime.end - config.solarTime.begin) * 3600 / config.interval * config.lineWidth);
  return 'body {font-family: arial;} '
       + '.chart {width: ' + width + 'px; height: 600px; border: solid black 1px; position: relative;} '
       + '.chart div {position: absolute; bottom: 0;}'
       + '.grid {display: inline-block; position: absolute; left: 0; color: gray; background-color: lightgray; width: ' + width + 'px; height: 1px; text-align: right;}'
       + '.grid:hover {height: 2px;}'
       + '.grid span {position: relative; left: 75px; bottom: 0.5em;}'
       + '.bar {display: inline-block; width: ' + printNum(config.lineWidth) + 'px; overflow: hidden; background-color: gold;} '
       + '.bar:hover {background-color: orange;} '
       + '.label {display: inline-block; width: 250px;}';   
}

function getGrid(){
  let result = '';
  for (let i=1;i<6;i++){
    result += '<span class="grid" style="bottom: ' + printNum(i*100) + 'px;"><span>' + printNum(i*100) + ' W</span></span>';
  }
  result += '<span class="grid" style="bottom: 560px; background-color: orange;"><span>560 W</span></span>';
  return result;
}

function getBody() {
  let body = '';
  body += '<div class="chart"><div>';
  for (let i=0;i<power.intervals.length;i++){
    body += '<span class="bar" style="height: ' + printNum(power.intervals[i].power) + 'px" title="' 
         + power.intervals[i].time + ': '
         + printNum(power.intervals[i].power) + ' W">&nbsp;</span>';
  }
  body += getGrid();
  body += '</div></div>';
  body += '<span class="label">Currently generated power</span><span>' + printNum(power.current) + ' W</span><br/>';
  body += '<span class="label">Today</span><span>' + printNum(energy.total) + ' Wh</span><br/>';
  body += '<span class="label">Last 3 days</span><br>';
  for (let i=0;i<energy.perDay.length;i++){
    body += '<span class="label"></span><span>' + printNum(energy.perDay[i]) + ' Wh</span><br>';
  }
  return body;
}

function showSolar(request, response, arguments){
  response.body = '<html><head><title>Solar</title><style>' 
                + getStyle() 
                + '</style></head><body style="font-family: arial;">' 
                + getBody()
                + '</body></html>';
  response.headers = [['Content-Type', 'text/html']];
  response.code = 200;
  response.send();
}

reset();
getSolarPower();
Timer.set(config.interval * 1000, true, getSolarPower, false);

HTTPServer.registerEndpoint('solar', showSolar, null);
