
"use strict";

/* =====================================
ELEMENTS
===================================== */

const screen = document.getElementById("screen");
const historyBox = document.getElementById("history");
const themeButton = document.getElementById("theme");

/* =====================================
CALCULATOR STATE
===================================== */

let current = "0";
let previous = null;
let operator = null;

let waiting = false;
let calculated = false;

/* =====================================
DISPLAY
===================================== */

function render() {
screen.textContent = current;
}

/* =====================================
DECIMAL HELPERS
===================================== */

/*
JavaScript normally stores numbers
using binary floating point.

Example:

0.1 + 0.2

can internally become:

0.30000000000000004

These functions reduce that problem.
*/

function decimals(number) {

const value = String(number);

if (value.includes("e-")) {
return Number(value.split("e-")[1]);
}

if (!value.includes(".")) {
return 0;
}

return value.split(".")[1].length;
}

function add(a, b) {

const power =
Math.pow(10, Math.max(
decimals(a),
decimals(b)
));

return (
Math.round(a * power) +
Math.round(b * power)
) / power;
}

function subtract(a, b) {

const power =
Math.pow(10, Math.max(
decimals(a),
decimals(b)
));

return (
Math.round(a * power) -
Math.round(b * power)
) / power;
}

function multiply(a, b) {

const aString = String(a);
const bString = String(b);

const aParts = aString.split(".");
const bParts = bString.split(".");

const aDigits = aParts.join("");
const bDigits = bParts.join("");

const places =
(aParts[1] ? aParts[1].length : 0) +
(bParts[1] ? bParts[1].length : 0);

return (
Number(aDigits) *
Number(bDigits)
) / Math.pow(10, places);
}

function divide(a, b) {

if (b === 0) {
throw new Error("Cannot divide by zero");
}

const aDecimals = decimals(a);
const bDecimals = decimals(b);

const aPower =
Math.pow(10, aDecimals);

const bPower =
Math.pow(10, bDecimals);

return (
(Math.round(a * aPower) /
Math.round(b * bPower)) *
(bPower / aPower)
);
}

/* =====================================
CLEAN RESULT
===================================== */

function clean(number) {

if (!Number.isFinite(number)) {
throw new Error("Invalid calculation");
}

/*
15 significant digits gives a practical
balance between accuracy and avoiding
floating-point noise.
*/

return Number(
Number(number).toPrecision(15)
).toString();
}

/* =====================================
CALCULATE
===================================== */

function calculate(a, op, b) {

a = Number(a);
b = Number(b);

switch (op) {

case "+":  
  return clean(add(a, b));  

case "-":  
  return clean(subtract(a, b));  

case "*":  
  return clean(multiply(a, b));  

case "/":  
  return clean(divide(a, b));  

default:  
  return clean(b);

}
}

/* =====================================
NUMBER INPUT
===================================== */

function numberInput(value) {

if (calculated) {

current = value;  

previous = null;  
operator = null;  

waiting = false;  
calculated = false;  

historyBox.textContent = "";  

render();  

return;

}

if (waiting) {

current = value;  

waiting = false;

} else {

if (current === "0") {  

  current = value;  

} else if (current.length < 30) {  

  current += value;  

}

}

render();
}

/* =====================================
DECIMAL
===================================== */

function decimalInput() {

if (calculated) {

current = "0.";  

previous = null;  
operator = null;  

waiting = false;  
calculated = false;  

historyBox.textContent = "";  

render();  

return;

}

if (waiting) {

current = "0.";  

waiting = false;  

render();  

return;

}

if (!current.includes(".")) {

current += ".";

}

render();
}

/* =====================================
OPERATOR
===================================== */

function setOperator(nextOperator) {

const value = Number(current);

/*
Pressing another operator changes
the selected operator.
*/

if (operator && waiting) {

operator = nextOperator;  

historyBox.textContent =  
  format(previous) +  
  " " +  
  symbol(nextOperator);  

return;

}

if (previous === null) {

previous = value;

} else if (operator) {

try {  

  const result =  
    calculate(  
      previous,  
      operator,  
      value  
    );  

  current = result;  

  previous = Number(result);  

  render();  

} catch (error) {  

  errorDisplay(error.message);  

  return;  
}

}

operator = nextOperator;

waiting = true;

calculated = false;

historyBox.textContent =
format(previous) +
" " +
symbol(operator);
}

/* =====================================
EQUAL
===================================== */

function equals() {

if (
operator === null ||
previous === null
) {
return;
}

const second = Number(current);

try {

const result =  
  calculate(  
    previous,  
    operator,  
    second  
  );  


historyBox.textContent =  
  format(previous) +  
  " " +  
  symbol(operator) +  
  " " +  
  format(second) +  
  " =";  


current = result;  

previous = null;  
operator = null;  

waiting = false;  
calculated = true;  


render();

} catch (error) {

errorDisplay(error.message);

}
}

/* =====================================
CLEAR
===================================== */

function clearCalculator() {

current = "0";

previous = null;
operator = null;

waiting = false;
calculated = false;

historyBox.textContent = "";

render();
}

/* =====================================
DELETE
===================================== */

function deleteNumber() {

if (waiting || calculated) {
return;
}

if (
current.length <= 1 ||
current === "-0"
) {

current = "0";

} else {

current =  
  current.slice(0, -1);  

if (  
  current === "-" ||  
  current === ""  
) {  

  current = "0";  

}

}

render();
}

/* =====================================
PLUS / MINUS
===================================== */

function changeSign() {

if (current === "0") {
return;
}

if (current.startsWith("-")) {

current =  
  current.substring(1);

} else {

current =  
  "-" + current;

}

render();
}

/* =====================================
PERCENT
===================================== */

function percentage() {

const value = Number(current);

/*
Example:

200 + 10% = 220  
200 - 10% = 180  
200 × 10% = 20  
200 ÷ 10% = 2000

*/

try {

if (  
  previous !== null &&  
  operator  
) {  

  if (  
    operator === "+" ||  
    operator === "-"  
  ) {  

    current =  
      clean(  
        multiply(  
          previous,  
          value / 100  
        )  
      );  

  } else {  

    current =  
      clean(value / 100);  

  }  

} else {  

  current =  
    clean(value / 100);  

}  

render();

} catch (error) {

errorDisplay(error.message);

}
}

/* =====================================
OPERATOR SYMBOLS
===================================== */

function symbol(op) {

switch (op) {

case "+":  
  return "+";  

case "-":  
  return "−";  

case "*":  
  return "×";  

case "/":  
  return "÷";  

default:  
  return op;

}
}

/* =====================================
NUMBER FORMAT
===================================== */

function format(value) {

const text = String(value);

/*
Do not add commas to scientific
notation.
*/

if (
text.includes("e") ||
text.includes("E")
) {
return text;
}

const parts =
text.split(".");

let integer =
Number(parts[0])
.toLocaleString("en-US");

if (parts.length > 1) {

return (  
  integer +  
  "." +  
  parts[1]  
);

}

return integer;
}

/* =====================================
ERROR
===================================== */

function errorDisplay(message) {

screen.textContent = "Error";

historyBox.textContent = message;

current = "0";

previous = null;
operator = null;

waiting = true;
calculated = false;
}

/* =====================================
BUTTON EVENTS
===================================== */

document
.querySelectorAll(".btn")
.forEach(button => {

button.addEventListener(  
  "click",  
  function () {  

    const value =  
      this.dataset.value;  

    const action =  
      this.dataset.action;  

          /* Light button sound */

    if (action === "clear") {

      playButtonSound("clear");

    } else {

      playButtonSound("normal");

    }


    /* Numbers */  

    if (  
      value !== undefined &&  
      /^[0-9]$/.test(value)  
    ) {  

      numberInput(value);  

      return;  
    }  


    /* Operators */  

    if (  
      value !== undefined &&  
      ["+", "-", "*", "/"]  
        .includes(value)  
    ) {  

      setOperator(value);  

      return;  
    }  


    /* Actions */  

    switch (action) {  

      case "clear":  
        clearCalculator();  
        break;  

      case "delete":  
        deleteNumber();  
        break;  

      case "percent":  
        percentage();  
        break;  

      case "sign":  
        changeSign();  
        break;  

      case "decimal":  
        decimalInput();  
        break;  

      case "equals":  
        equals();  
        break;  

    }  

  },  
  {  
    passive: true  
  }  
);

});

/* =====================================
KEYBOARD
===================================== */

document.addEventListener(
"keydown",
function (event) {

const key = event.key;  


if (/^[0-9]$/.test(key)) {  

  numberInput(key);  

  return;  
}  


if (key === ".") {  

  decimalInput();  

  return;  
}  


if (  
  ["+", "-", "*", "/"]  
    .includes(key)  
) {  

  setOperator(key);  

  return;  
}  


if (  
  key === "Enter" ||  
  key === "="  
) {  

  event.preventDefault();  

  equals();  

  return;  
}  


if (key === "Backspace") {  

  deleteNumber();  

  return;  
}  


if (key === "Escape") {  

  clearCalculator();  

  return;  
}  


if (key === "%") {  

  percentage();  

}

}
);

/* =====================================
THEME
===================================== */

themeButton.addEventListener(
"click",
function () {

document.body.classList.toggle(  
  "light"  
);  


if (  
  document.body.classList  
    .contains("light")  
) {  

  themeButton.textContent = "☾";  

} else {  

  themeButton.textContent = "☼";  

}

},
{
passive: true
}
);

/* =====================================
START
===================================== */

render();
/* =====================================
   LIGHT BUTTON SOUND
===================================== */

let audioContext = null;

function playButtonSound(type = "normal") {

  try {

    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) return;

    if (!audioContext) {
      audioContext = new AudioContext();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const oscillator =
      audioContext.createOscillator();

    const gain =
      audioContext.createGain();

    oscillator.type = "sine";

    if (type === "clear") {

      /* Slightly deeper sound for AC */

      oscillator.frequency.setValueAtTime(
        420,
        audioContext.currentTime
      );

      oscillator.frequency.exponentialRampToValueAtTime(
        260,
        audioContext.currentTime + 0.07
      );

      gain.gain.setValueAtTime(
        0.045,
        audioContext.currentTime
      );

    } else {

      /* Soft premium tap */

      oscillator.frequency.setValueAtTime(
        650,
        audioContext.currentTime
      );

      oscillator.frequency.exponentialRampToValueAtTime(
        480,
        audioContext.currentTime + 0.045
      );

      gain.gain.setValueAtTime(
        0.035,
        audioContext.currentTime
      );
    }

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.06
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();

    oscillator.stop(
      audioContext.currentTime + 0.065
    );

  } catch (error) {

    console.log(
      "Sound error:",
      error
    );

  }
}
