var Gpio = require("onoff").Gpio; //include onoff to interact with the RPi GPIO pins
//var prompt = require("prompt-sync")({ sigint: false }); //include to take input from console
var sun = require("sun-time"); //include for calculating sunset time
const http = require("http"); //include for hosting web interface

//setup config parameters and defaults
var mode = "show", //default mode.  Command line option -m:string willl override.
  cycles = 5, //default base cycles per scene.  Command line option -c:number willl override.
  delay = 50, //in ms, default base delay between state changes (on/off duration - speed of routine).  Command line option -d:number willl override.
  latitude = 42.192324, //decimal, for calculating sunset
  longtitude = -88.088098, //decimal, for calculating sunset
  elevation = 260, //in meters, for calculating sunset
  startTime = 1020, //in minutes, i.e. 1:30pm = 13 * 60 + 30,sunset can override this
  stopTime = 1430, //in minutes - stop before midnight
  state = "off"; //Maintains the current state of the light show.

let statusLed = new Gpio(26, "out");
async function statusLed() {
  let on = true;
  while (true) {
    await sleep(1000);
    if (on === true) {
      statusLed.writeSync(0);
      on = false;
    } else {
      statusLed.writeSync(1);
      on = true;
    }
  }
}

//Tie light objects to GPIO pins and set pin behavior.  This is how the SW accesses the HW
let light0 = new Gpio(18, "out");
let light1 = new Gpio(23, "out");
let light2 = new Gpio(24, "out");
let light3 = new Gpio(25, "out");
let light4 = new Gpio(12, "out");
let light5 = new Gpio(16, "out");
let light6 = new Gpio(20, "out");
let light7 = new Gpio(21, "out");

//Array of light objects.  Each of these is an addressable light circuit.
let lightArray = [
  light0,
  light1,
  light2,
  light3,
  light4,
  light5,
  light6,
  light7,
];

//A scene is an array of states played in sequence.  8 characters for 8 light circuits. 1=on, 0=off.
//"Chase" Scene - single light chases back and forth
var scene01 = [
  "10000000",
  "01000000",
  "00100000",
  "00010000",
  "00001000",
  "00000100",
  "00000010",
  "00000001",
  "00000000",
  "00000001",
  "00000010",
  "00000100",
  "00001000",
  "00010000",
  "00100000",
  "01000000",
  "10000000",
  "00000000",
]; //18 States

//"Flash" Scene - all lights flash on and off together
var scene02 = ["11111111", "00000000"]; //2 States

//"Railroad" - Alternate flashing between odds and evens
var scene03 = ["01010101", "10101010"]; //2 States

//"Paint On/Off" Scene - turn lights on in a wiping motion and then off the same way
var scene04 = [
  "10000000",
  "11000000",
  "11100000",
  "11110000",
  "11111000",
  "11111100",
  "11111110",
  "11111111",
  "01111111",
  "00111111",
  "00011111",
  "00001111",
  "00000111",
  "00000011",
  "00000001",
  "00000000",
  "00000001",
  "00000011",
  "00000111",
  "00001111",
  "00011111",
  "00111111",
  "01111111",
  "11111111",
  "11111110",
  "11111100",
  "11111000",
  "11110000",
  "11100000",
  "11000000",
  "10000000",
  "00000000",
]; //32 states

//"Pong" Scene - three consecutive lights move back and forth between the ends
var scene05 = [
  "00000111",
  "00001110",
  "00011100",
  "00111000",
  "01110000",
  "11100000",
  "11100000",
  "01110000",
  "00111000",
  "00011100",
  "00001110",
  "00000111",
];

//"Arcade" Scene - simulates lights moving in one direction with two on at once spaced 4 apart
var scene06 = ["10001000", "01000100", "00100010", "00010001"]; //4 states

//"Part" Scene - similar to the "Paint" scene but this one paints off/on symetrical about the center
var scene07 = [
  "01111110",
  "11111111",
  "11100111",
  "11000011",
  "10000001",
  "00000000",
  "00000000",
  "00000000",
  "10000001",
  "11000011",
  "11100111",
  "11111111",
  "01111110",
  "00111100",
  "00011000",
  "00000000",
  "00000000",
  "00000000",
];

//"Train" Scene - simulates an eight car train passing from one side to the next
var scene08 = [
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000", //Array of light objects.  Each of these is an addressable light circuit.
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "10000000",
  "11000000",
  "11100000",
  "11110000",
  "11111000",
  "11111100",
  "11111110",
  "11111111",
  "01111111",
  "00111111",
  "00011111",
  "00001111",
  "00000111",
  "00000011",
  "00000001",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
];

//"Test" Scene - For setup mode, flashes each light the same # of times as its position (1-8)
var testScene = [
  "11111111",
  "00000000",
  "01111111",
  "00000000",
  "00111111",
  "00000000",
  "00011111",
  "00000000",
  "00001111",
  "00000000",
  "00000111",
  "00000000",
  "00000011",
  "00000000",
  "00000001",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
  "00000000",
];

//set sunset time & then refresh it every four hours
sunSetInMinutes(latitude, longtitude, elevation);
setInterval(sunSetInMinutes, 14400000, latitude, longtitude, elevation);

//initialize lights to all off
allLightsOff();

const server = http.createServer((request, response) => {
  response.statusCode = "200";
  response.setHeader("Content-Type", "text/plain");
  response.end(
    `xmaslights.js is running\nprogram mode: ${mode}\nlight state: ${state}\nscheduled wake time (mins): ${startTime}\nscheduled sleep time (mins): ${stopTime}`
  );
});

server.listen(3000);

//process command line aruments given at startup and override defaults
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i][0] === "-") {
    switch (process.argv[i][1]) {
      case "m": //mode
        mode = process.argv[i].slice(3);
        break;
      case "c": //cycles - base # of cycles to run for each scene
        cycles = process.argv[i].slice(3);
        break;
      case "d": //delay - base delay to use between lighting changes (duration of a flash)
        delay = process.argv[i].slice(3);
        break;
      case "h": //help - show usage help
        console.log(
          "Usage: scriptName [-m:(1*(show, allon, alloff, setup, shimmer, twinkle, scenes))] for mode. Default = show.\n",
          "[-c:Integer] for # of cycles per scene. Default = 5.\n",
          "[-d:Integer] for delay between state changes in ms. Default = 50.\n",
          "example: node xmaslights.js -m:show -c:5 -d:50\n"
        );
        allLightsOff();
        process.exit();
      default:
        console.log(`${process.argv[i]} not recognized.`);
    }
  }
}

//apply mode - deault is "show" but can be overridden on the command line
switch (mode) {
  case "show":
    playShow();
    break;
  case "allon":
    allLightsOn();
    break;
  case "alloff":
    allLightsOff();
    break;
  case "setup":
    setUpUtility();
    break;
  case "shimmer":
    shimmer();
    break;
  case "twinkle":
    twinkle();
    break;
  case "scenes":
    playSceneLineUp();
    break;
  case "yahtzee":
    yahtzee();
    break;
  case "popcorn":
    popcorn();
    break;
  default:
    console.log('Mode not valid. Run "node xmaslights -h" for help.\n');
    allLightsOff();
    process.exit();
}

//changes the routine based on the "state" assigned by the stateMachine function
//used in the "show" mode
async function playShow() {
  state = "all-on";
  stateMachine();
  let timeStamp = new Date();
  console.log(
    `\n\nApplication started @ ${timeStamp.toLocaleTimeString("en-US")}`
  );
  while (true) {
    if (state === "off") {
      await sleep(2500);
      continue;
    } else if (state === "show") {
      timeStamp = new Date();
      console.log(
        `Starting Scene Lineup @ ${timeStamp.toLocaleTimeString("en-US")}`
      );
      await playSceneLineUp();
    } else if (state === "all-on") {
      timeStamp = new Date();
      console.log(
        `Starting "all-on" @ ${timeStamp.toLocaleTimeString("en-US")}`
      );
      await allLightsOn();
    } else if (state === "yahtzee") {
      timeStamp = new Date();
      console.log(
        `Starting "yahtzee" @ ${timeStamp.toLocaleTimeString("en-US")}`
      );
      await yahtzee(cycles, delay);
    } else if (state === "popcorn") {
      timeStamp = new Date();
      console.log(
        `Starting "popcorn" @ ${timeStamp.toLocaleTimeString("en-US")}`
      );
      await popcorn(cycles, delay);
    } else if (state === "shimmer") {
      timeStamp = new Date();
      console.log(
        `Starting "shimmer" @ ${timeStamp.toLocaleTimeString("en-US")}`
      );
      await shimmer(cycles, delay);
    } else if (state === "twinkle") {
      timeStamp = new Date();
      console.log(
        `Starting "twinkle" @ ${timeStamp.toLocaleTimeString("en-US")}`
      );
      await twinkle(cycles, delay);
    } else {
      await sleep(2500);
    }
  }
}

//Sets the shows "state" based on time of day (after sunset) and where it is in the quarter hour
async function stateMachine() {
  let time = new Date();
  currentTime = time.getHours() * 60 + time.getMinutes();
  console.log(`Current time is ${currentTime} and Sunset time is ${startTime}`);
  while (true) {
    time = new Date();
    currentTime = time.getHours() * 60 + time.getMinutes();
    if (currentTime < startTime || currentTime >= stopTime) {
      if (state !== "off") {
        console.log(
          `Putting lights to sleep @ ${time.toLocaleTimeString("en-US")}`
        );
        allLightsOff();
      }
      state = "off";
    } else if (time.getMinutes() % 15 < 1) {
      state = "show";
    } else if (time.getMinutes() % 15 < 9) {
      state = "all-on";
    } else if (time.getMinutes() % 15 < 11) {
      state = "yahtzee";
    } else if (time.getMinutes() % 15 < 13) {
      state = "popcorn";
    } else if (time.getMinutes() % 15 < 14) {
      state = "shimmer";
    } else {
      state = "twinkle";
    }
    await sleep(2500);
  }
}

//Plays a lineup of multiple scenes during "show" state
async function playSceneLineUp() {
  state = "show";
  while (state === "show") {
    await playScene(scene02, 4 * cycles, 3 * delay);
    await playScene(scene03, 4 * cycles, 3 * delay);
    await playScene(scene04, 0.2 * cycles, 2 * delay);
    await playScene(scene04, 0.2 * cycles, 1.8 * delay);
    await playScene(scene04, 0.2 * cycles, 1.625 * delay);
    await playScene(scene04, 0.2 * cycles, 1.44 * delay);
    await playScene(scene04, 0.2 * cycles, 1.25 * delay);
    await playScene(scene04, 0.2 * cycles, 1.06 * delay);
    await playScene(scene04, 0.2 * cycles, 0.875 * delay);
    await playScene(scene04, 0.2 * cycles, 0.675 * delay);
    await playScene(scene04, 0.2 * cycles, 0.5 * delay);
    await playScene(scene01, 1.4 * cycles, 2 * delay);
    await playScene(scene05, 3 * cycles, 2 * delay);
    await playScene(scene06, 5 * cycles, 2 * delay);
    await playScene(scene08, 0.6 * cycles, 0.75 * delay);
    await playScene(scene07, 1.5 * cycles, 2 * delay);
    await playScene(scene08.reverse(), 0.6 * cycles, 0.75 * delay);
    await playScene(scene06.reverse(), 5 * cycles, 2 * delay);
  }
}

//Loops during "all-on" state - all on, no animation
async function allLightsOn() {
  state = "all-on";
  while (state === "all-on") {
    for (let i = 0; i < lightArray.length; i++) {
      lightArray[i].writeSync(1);
    }
    await sleep(2500);
  }
}

//Loops during "shimmer" state - all one, with one randomly turning off/on at a time very quickly
async function shimmer(cycles = 5, delay = 50) {
  state = "shimmer";
  for (let i = 0; i < lightArray.length; i++) {
    lightArray[i].writeSync(1);
  }
  while (state === "shimmer") {
    j = Math.floor(Math.random() * 8);
    lightArray[j].writeSync(0);
    k = Math.floor(Math.random() * 2);
    await sleep(delay * (1 + k));
    lightArray[j].writeSync(1);
    j = Math.floor(Math.random() * 4) + 1;
    await sleep(delay * 1 * j);
  }
}

//Loops during "twinkle state" - all off, with one randomly turning on/off at a time very quickly
async function twinkle(cycles = 5, delay = 50) {
  state = "twinkle";
  for (let i = 0; i < lightArray.length; i++) {
    lightArray[i].writeSync(0);
  }
  while (state === "twinkle") {
    j = Math.floor(Math.random() * 8);
    lightArray[j].writeSync(1);
    k = Math.floor(Math.random() * 0.5);
    await sleep(delay * (0.75 + k));
    lightArray[j].writeSync(0);
    j = Math.floor(Math.random() * 10) + 1;
    await sleep(delay * 1 * j);
  }
}

//Loops during "yahtzee" state - randomly assigns on/off value to each of eight lights and then displays as such for each loop iteration
async function yahtzee(cycles = 5, delay = 50) {
  state = "yahtzee";
  while (state === "yahtzee") {
    let yPattern = "";
    for (let i = 0; i < 8; i++) {
      yPattern += Math.floor(Math.random() * 2);
    }
    for (let j = 0; j < yPattern.length; j++) {
      lightArray[j].writeSync(Number(yPattern.charAt(j)));
    }
    await sleep(delay * 30);
  }
}

//Loops during "popcorn" state - starts w/ all off and then turns all lights on one at a time in random order, then off again in same fashion.
async function popcorn(cycles = 5, delay = 50) {
  state = "popcorn";
  let lightArrayCopy = lightArray.map((a) => a);
  while (state === "popcorn") {
    lightArrayCopy.sort(() => Math.random() - 0.5);
    for (let i = 0; i < lightArrayCopy.length; i++) {
      lightArrayCopy[i].writeSync(1);
      await sleep(delay * 5);
    }
    await sleep(1000);
    lightArrayCopy.sort(() => Math.random() - 0.5);
    for (let i = 0; i < lightArrayCopy.length; i++) {
      lightArrayCopy[i].writeSync(0);
      await sleep(delay * 5);
    }
    await sleep(1000);
  }
}
//Function plays a single scene specfied # of times with specified delay.
//Used by playSceneLineup()
async function playScene(scene = ["00000000"], cycles = 5, delay = 50) {
  for (let h = 0; h < cycles; h++) {
    for (let i = 0; i < scene.length; i++) {
      for (let j = 0; j < scene[i].length; j++) {
        lightArray[j].writeSync(Number(scene[i].charAt(j)));
      }
      await sleep(delay);
    }
  }
  allLightsOff();
}

//Function for the setup mode command line option.  Pulses each light # of times corresponding to it's # (1-8)
async function setUpUtility() {
  while (true) {
    await playScene(testScene, cycles, 10 * delay);
  }
}

//Utility function to immediately shut off all lights.
function allLightsOff() {
  for (let i = 0; i < lightArray.length; i++) {
    lightArray[i].writeSync(0);
  }
}

//Sleep function to create a delay between state changes.  Slows down the program so humans can see the show.   Creates the delay between on/off states.
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

//function to calculate the sunset in minutes
function sunSetInMinutes(latitude, longtitude, elevation) {
  if (latitude && longtitude && elevation) {
    let solar = sun(latitude, longtitude, elevation); //get sunrise/set object
    let aSunset = solar.set.split(":"); //get sunset string and split into array
    startTime = Number(aSunset[0]) * 60 + Number(aSunset[1]) + 60;
    console.log("Calculated sunset in miuntes as ", startTime);
  }
}

//Exit function for ctrl+c - when using this key combo to stop the program, turns lights off on way out
process.on("SIGINT", () => {
  allLightsOff();
  statusLed.writeSync(0);
  process.exit();
});
