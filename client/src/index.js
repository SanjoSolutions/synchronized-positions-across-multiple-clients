import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { Chest } from './Chest';
import reportWebVitals from './reportWebVitals';
import {
  roomWidth,
  roomHeight,
  wallThickness,
  radius,
  clamp,
  intersects,
  moveOut,
  distance,
} from "shared/index.js"

const canvas = document.querySelector('canvas')
canvas.width = window.innerWidth
canvas.height = window.innerHeight
const context = canvas.getContext('2d')

const root = ReactDOM.createRoot(document.getElementById('root'))

const units = {}
let objects = []
let x = null
let y = null
let angle = null
let color = 'black'

function draw() {
  // context.clearRect(0, 0, canvas.width, canvas.height)

  context.fillStyle = 'green'
  context.strokeStyle = 'black'
  context.beginPath()
  context.rect(0, 0, roomWidth, roomHeight)
  context.fill()
  context.stroke()

  drawObjects()

  for (const unit of Object.values(units)) {
    drawUnit(unit)
  }
  drawUnit({x, y, angle, color})
}

function drawObjects() {
  objects.forEach(drawObject)
}

function drawObject(object) {
  context.strokeStyle = 'black'
  context.fillStyle = '#a6573b'
  context.beginPath()
  context.rect(object.x - 0.5 * object.width, object.y - 0.5 * object.height, object.width, object.height)
  context.fill()
  context.stroke()
}

function drawUnit(unit) {
  if (hasPosition(unit)) {
    context.fillStyle = unit.color || 'black'
    context.beginPath()
    context.arc(unit.x, unit.y, radius, 0, 2 * Math.PI)
    context.fill()

    context.fillStyle = 'white'
    const angleBetween = degreeToRadian(60)
    {
      const x = unit.x + 0.5 * radius * Math.cos(unit.angle - 0.5 * angleBetween)
      const y = unit.y + 0.5 * radius * Math.sin(unit.angle - 0.5 * angleBetween)
      context.beginPath()
      context.arc(x, y, 1.5, 0, 2 * Math.PI)
      context.fill()
    }
    {
      const x = unit.x + 0.5 * radius * Math.cos(unit.angle + 0.5 * angleBetween)
      const y = unit.y + 0.5 * radius * Math.sin(unit.angle + 0.5 * angleBetween)
      context.beginPath()
      context.arc(x, y, 1.5, 0, 2 * Math.PI)
      context.fill()
    }
  }
}

draw()

const keyStates = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false
}

window.addEventListener('keydown', function (event) {
  if (keyStates.hasOwnProperty(event.code)) {
    keyStates[event.code] = true
  }
})

window.addEventListener('keyup', function (event) {
  if (keyStates.hasOwnProperty(event.code)) {
    keyStates[event.code] = false
  }
})

window.addEventListener('keypress', function (event) {
  if (event.code === 'Space') {
    const object = retrieveClosestObject()

    if (object && determineDistanceToObject(object) <= radius) {
      root.render(
        <React.StrictMode>
          <Chest object={object} onClose={() => root.render(<div></div>)} />
        </React.StrictMode>
      )
    }
  }
})

function retrieveClosestObject() {
  return findMin(objects, object => distance(object, {x, y})).value
}

function findMin(values, fn) {
  if (values.length === 0) {
    return {
      value: null,
      index: null
    }
  } else {
    let minimumValue = values[0]
    let minimumIndex = 0
    let comparisonValueOfCurrentMinimum = fn(minimumValue)

    for (let index = 1; index < values.length; index++) {
      const value = values[index]
      const comparisonValue = fn(value)
      if (comparisonValue < comparisonValueOfCurrentMinimum) {
        minimumValue = value
        minimumIndex = index
        comparisonValueOfCurrentMinimum = comparisonValue
      }
    }

    return {
      value: minimumValue,
      index: minimumIndex
    }
  }
}

const socket = new WebSocket('ws://localhost:8080')

socket.onmessage = function (event) {
  const data = JSON.parse(event.data)
  if (data.type === 'ID') {
    localStorage.setItem('ID', data.ID)
  } else if (data.type === 'position') {
    x = data.x
    y = data.y
    angle = data.angle
  } else if (data.type === 'color') {
    color = data.color
  } else if (data.type === 'disconnected') {
    delete units[data.ID]
  } else if (data.type === 'objects') {
    objects = data.objects
  } else {
    if (data.ID === retrieveID()) {
      x = data.x
      y = data.y
      angle = data.angle
    } else {
      units[data.ID] = data
    }
  }
  draw()
}

socket.onopen = function () {
  const ID = retrieveID()
  if (ID) {
    sendID(ID)
  } else {
    requestID()
  }
}

let lastTime = null

function requestNextAnimationFrame() {
  requestAnimationFrame(onRequestAnimationFrame)
}

function onRequestAnimationFrame(time) {
  let timePassed
  if (lastTime !== null) {
    timePassed = time - lastTime
  } else {
    timePassed = null
  }

  if (timePassed !== null && hasPosition({x, y})) {
    const previousX = x
    const previousY = y

    let deltaX = 0
    let deltaY = 0
    if (keyStates.KeyW) {
      deltaY -= 1 * (timePassed / (1000 / 60))
    }
    if (keyStates.KeyA) {
      deltaX -= 1 * (timePassed / (1000 / 60))
    }
    if (keyStates.KeyS) {
      deltaY += 1 * (timePassed / (1000 / 60))
    }
    if (keyStates.KeyD) {
      deltaX += 1 * (timePassed / (1000 / 60))
    }

    x += deltaX
    y += deltaY

    for (const unit of Object.values(units)) {
      if (intersects({x, y}, unit)) {
        const movedOutPosition = moveOut({x, y}, unit)
        x = movedOutPosition.x
        y = movedOutPosition.y
      }
    }

    x = clamp(x, radius + wallThickness, roomWidth - radius - wallThickness)
    y = clamp(y, radius + wallThickness, roomHeight - radius - wallThickness)

    if (deltaX !== 0 || deltaY !== 0) {
      angle = Math.atan2(y - previousY, x - previousX)
    }

    if (x !== previousX || y !== previousY) {
      draw()
      sendMoveToServer({deltaX: x - previousX, deltaY: y - previousY, clientX: x, clientY: y, clientAngle: angle})
    }
  }

  lastTime = time

  requestNextAnimationFrame()
}

requestNextAnimationFrame()

function sendMoveToServer({deltaX, deltaY, clientX, clientY, clientAngle}) {
  const OPEN = 1
  if (socket.readyState === OPEN) {
    socket.send(JSON.stringify({
      type: 'move',
      deltaX,
      deltaY,
      clientX,
      clientY,
      clientAngle
    }))
  }
}

function sendID(ID) {
  socket.send(JSON.stringify({
    type: 'ID',
    ID
  }))
}

function requestID() {
  socket.send(JSON.stringify({
    type: 'requestID'
  }))
}

function hasPosition(unit) {
  return typeof unit.x === 'number' && typeof unit.y === 'number'
}

function retrieveID() {
  let ID = localStorage.getItem('ID')
  if (ID) {
    ID = Number(ID)
  }
  return ID
}

function degreeToRadian(value) {
  return value * (2 * Math.PI / 360)
}

function determineDistanceToObject(object) {
  const ox = object.x
  const oy = object.y

  if (x >= ox && x <
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
