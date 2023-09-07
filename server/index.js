import { WebSocketServer } from 'ws'
import { writeJSON } from '@sanjo/write-json'
import process from 'node:process'
import { writeFileSync, readFileSync } from 'node:fs'
import {
  roomWidth,
  roomHeight,
  wallThickness,
  radius,
  isDifferent,
  clamp,
  intersects,
  moveOut
} from "../shared/index.js"

let database
try {
  database = JSON.parse(readFileSync('database.json', {encoding: 'utf-8'}))
} catch (error) {
  database = {nextID: 1, units: {}}
}

const server = new WebSocketServer({port: 8080})

const socketsToID = new Map()

const colors = [
  'blue',
  'green'
]

server.on('connection', function (socket) {
  let ID = null

  socketsToID.set(socket, ID)

  sendPositionsOfOtherUnits(socket)
  sendObjects(socket)

  socket.on('error', console.error)

  socket.on('message', function (data) {
    data = JSON.parse(data)

    if (data.type === 'requestID') {
      ID = database.nextID
      database.nextID++

      socketsToID.set(socket, ID)
      if (!database.units[ID]) {
        database.units[ID] = {ID, x: 11, y: 11, angle: 0, color: null, online: true}
      }

      sendID(socket, ID)

      const clientData = database.units[ID]
      sendPositionToAllClients({ID, x: clientData.x, y: clientData.y, angle: clientData.angle})
    } else if (data.type === 'ID') {
      ID = data.ID

      socketsToID.set(socket, ID)
      if (database.units[ID]) {
        database.units[ID].online = true
      } else {
        database.units[ID] = { x: 0, y: 0, angle: 0, color: null, online: true }
      }

      const clientData = database.units[ID]
      sendPositionToAllClients({ID, x: clientData.x, y: clientData.y, angle: clientData.angle})
    } else if (data.type === 'move') {
      if (ID) {
        let previousX = database.units[ID].x
        let previousY = database.units[ID].y

        let x = database.units[ID].x
        let y = database.units[ID].y

        x += data.deltaX
        y += data.deltaY

        for (const unit of Object.values(database.units).filter(({online}) => online)) {
          if (unit.ID !== ID) {
            if (intersects({x, y}, unit)) {
              const movedOutPosition = moveOut({x, y}, unit)
              x = movedOutPosition.x
              y = movedOutPosition.y
            }
          }
        }

        x = clamp(x, radius + wallThickness, roomWidth - radius - wallThickness)
        y = clamp(y, radius + wallThickness, roomHeight - radius - wallThickness)
        const angle = Math.atan2(y - previousY, x - previousX)

        database.units[ID].x = x
        database.units[ID].y = y
        database.units[ID].angle = angle

        if (isDifferent(database.units[ID], {x: data.clientX, y: data.clientY}) || angle !== data.clientAngle) {
          sendPosition(socket, database.units[ID])
        }

        if (isDifferent(database.units[ID], {x: previousX, y: previousY})) {
          sendPositionToOtherClients(socket, database.units[ID])
        }
      }
    }
  })

  socket.on('close', function () {
    const disconnectedClientID = socketsToID.get(socket)
    database.units[disconnectedClientID].online = false
    socketsToID.delete(socket)
    for (const client of socketsToID.keys()) {
      if (client !== socket) {
        sendClientDisconnected(client, disconnectedClientID)
      }
    }
  })
})

setInterval(async function () {
  await writeJSON('database.json', database)
}, 60000)

function sendPositionsOfOtherUnits(socket) {
  for (const client of socketsToID.keys()) {
    if (client !== socket) {
      const ID = socketsToID.get(client)
      if (ID) {
        const data = database.units[ID]
        socket.send(JSON.stringify({ID, x: data.x, y: data.y, angle: data.angle}))
      }
    }
  }
}

function sendClientDisconnected(socket, disconnectedClientID) {
  socket.send(JSON.stringify({type: 'disconnected', ID: disconnectedClientID}))
}

function sendColor(socket, color) {
  socket.send(JSON.stringify({type: 'color', color}))
}

function sendID(socket, ID) {
  socket.send(JSON.stringify({type: 'ID', ID}))
}

function sendPosition(socket, position) {
  socket.send(JSON.stringify({type: 'position', x: position.x, y: position.y, angle: position.angle}))
}

function sendPositionToOtherClients(client, position) {
  const data = JSON.stringify({ID: position.ID, x: position.x, y: position.y, angle: position.angle})
  for (const client2 of socketsToID.keys()) {
    if (client2 !== client) {
      client2.send(data)
    }
  }
}

function sendPositionToAllClients(position) {
  for (const client of socketsToID.keys()) {
    client.send(JSON.stringify(position))
  }
}

function sendObjects(socket) {
  socket.send(JSON.stringify({
    type: 'objects',
    objects: database.objects
  }))
}

process.on('exit', function () {
  writeFileSync('database.json', JSON.stringify(database, null, 2))
})

function exit() {
  process.exit()
}

process.on('SIGINT', exit)
process.on('SIGUSR1', exit)
process.on('SIGUSR2', exit)
process.on('uncaughtException', function (error) {
  console.error(error)
  exit()
})
