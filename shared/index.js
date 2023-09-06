export const roomWidth = 300
export const roomHeight = 200
export const wallThickness = 1
export const radius = 10

export function isDifferent(pointA, pointB) {
  return pointA.x !== pointB.x || pointA.y !== pointB.y
}

export function clamp(value, min, max) {
  return Math.min(Math.max(min, value), max)
}

export function intersects(positionA, positionB) {
  return distance(positionA, positionB) < 2 * radius
}

export function distance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

export function moveOut(positionToMoveOut, positionToMoveOutOf) {
  const angle = Math.atan2(positionToMoveOut.y - positionToMoveOutOf.y, positionToMoveOut.x - positionToMoveOutOf.x)
  return {
    x: positionToMoveOutOf.x + 2 * radius * Math.cos(angle),
    y: positionToMoveOutOf.y + 2 * radius * Math.sin(angle)
  }
}

export function noOperation() {
  // No operation
}
