import type * as THREE from 'three'

export interface IPoint {
  lat: number
  lng: number
  z: number
  id?: string
}

export function getDistance(p1: IPoint, p2: IPoint) {
  if (p1.z === p2.z) {
    const distance = Math.sqrt((p1.lat - p2.lat) ** 2 + (p1.lng - p2.lng) ** 2)
    return Math.floor(distance * 100) / 100
  } else {
    const distance = Math.sqrt((p1.lat - p2.lat) ** 2 + (p1.lng - p2.lng) ** 2 + (p1.z - p2.z) ** 2)
    return Math.floor(distance * 100) / 100
  }
}

/**
 * 判断两条线是否连续
 * */
export function isLineContinuous(line1, line2) {
  const ok =
    isPointEqual(line1.start, line2.start) || isPointEqual(line1.start, line2.end) || isPointEqual(line1.end, line2.start) || isPointEqual(line1.end, line2.end)

  return ok
}

/**
 * 判断两坐标点是否相等
 * */
export function isPointEqual(point1, point2) {
  return point1.lat === point2.lat && point1.lng === point2.lng && point1.z === point2.z
}

export interface IPosition {
  x: number
  y: number
}
/**
 * @see https://juejin.cn/post/6844904025587105800
 * !#en Test line and line
 * !#zh 测试线段与线段是否相交
 * @method linesIntersect
 * @param {Vec2} a1 - The start point of the first line
 * @param {Vec2} a2 - The end point of the first line
 * @param {Vec2} b1 - The start point of the second line
 * @param {Vec2} b2 - The end point of the second line
 * @return {boolean}
 */
export function linesIntersect(a1: IPosition, a2: IPosition, b1: IPosition, b2: IPosition) {
  // b1->b2向量 与 a1->b1向量的向量积
  const ua_t = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x)
  // a1->a2向量 与 a1->b1向量的向量积
  const ub_t = (a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x)
  // a1->a2向量 与 b1->b2向量的向量积
  const u_b = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y)
  // u_b == 0时，角度为0或者180 平行或者共线不属于相交
  if (u_b !== 0) {
    const ua = ua_t / u_b
    const ub = ub_t / u_b

    if (0 <= ua && ua <= 1 && 0 <= ub && ub <= 1) {
      // 交点坐标
      const x = a1.x + ua * (a2.x - a1.x)
      const y = a1.y + ua * (a2.y - a1.y)
      return { lat: Math.floor(x * 100) / 100, lng: Math.floor(y * 100) / 100 }
      // return { lat: x, lng: y }
    }
  }

  return false
}

const a1 = {
  x: 1206,
  y: -130
}
const a2 = {
  x: 1209,
  y: 1357
}
const b1 = {
  x: 1206.7928561156089,
  y: 262.992347970177
}
const b2 = {
  x: 938,
  y: -50
}

console.log(linesIntersect(a1, a2, b1, b2))
/**
 * !#en Calculate the distance of point to line.
 * !#zh 计算点到直线的距离。如果这是一条线段并且垂足不在线段内，则会计算点到线段端点的距离。
 * @method pointLineDistance
 * @param {Vec2} point - The point
 * @param {Vec2} start - The start point of line
 * @param {Vec2} end - The end point of line
 * @param {boolean} isSegment - whether this line is a segment
 * @return {number}
 */
export function pointLineDistance(point: IPosition, start: IPosition, end: IPosition, isSegment = true) {
  let dx = end.x - start.x
  let dy = end.y - start.y
  const d = dx * dx + dy * dy
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / d
  let p

  if (!isSegment) {
    p = { x: start.x + t * dx, y: start.y + t * dy }
  } else {
    if (d) {
      if (t < 0) p = start
      else if (t > 1) p = end
      else p = { x: start.x + t * dx, y: start.y + t * dy }
    } else {
      p = start
    }
  }

  dx = point.x - p.x
  dy = point.y - p.y
  // 判断交点是否是垂点
  const isVertical = t >= 0 && t <= 1

  return { distance: Math.sqrt(dx * dx + dy * dy), point: { lat: p.x, lng: p.y }, isVertical }
}

export function disposeThreeJs(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  scene.traverse((child: any) => {
    if (child.material) {
      child.material.dispose()
    }

    if (child.geometry) {
      child.geometry.dispose()
    }

    if (child.dispose) {
      child.dispose()
    }

    child = null
  })
  renderer.forceContextLoss()
  renderer.dispose()
  scene.clear()
}
