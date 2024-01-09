import L from 'leaflet'
import { ElMessage } from 'element-plus'
import type { IPoint } from '@/utils'
import { getDistance, isLineContinuous, isPointEqual, linesIntersect, pointLineDistance } from '@/utils'
import { useMapStore } from '@/store/map'
import { getLineData } from '@/views/DrawLine'

export type IRouteRaw = IPoint[][]
interface ISegment {
  start: IPoint
  end: IPoint
  distance: number
}

function generateColor(number) {
  // 通过一些算法生成红、绿、蓝的分量
  const red = (number * 17) % 256
  const green = (number * 29) % 256
  const blue = (number * 13) % 256

  // 返回RGB颜色字符串
  return `rgb(${red},${green},${blue})`
}

export function viewSegments(arr?: ISegment[]) {
  arr ??= handleData(getLineData())
  const mapStore = useMapStore()
  const list = arr.filter((item) => [item.start.z, item.end.z].includes(mapStore.floorHeight()))
  for (const [index, segment] of list.entries()) {
    // 根据index生成不同颜色
    L.polyline([segment.start, segment.end], { color: generateColor(index * 40), weight: 5 }).addTo(mapStore.map)
  }
}

const maxDistance = 100
class Node {
  parent: Node = null
  cost: number = null
  toEndDistance: number = null
  id: string
  point: IPoint
  children: IGraphChildren[]
  constructor(segment: IGraph, endPoint: IPoint) {
    this.id = segment.id
    this.children = segment.children
    this.point = segment.point
    this.toEndDistance = getDistance(this.point, endPoint)
  }
}

export class NavigateRoute {
  nodes: Node[] = []
  openNode: Node
  closeList: Node[] = []
  path: IPoint[] = []

  startPoint: IPoint
  endPoint: IPoint

  constructor() {}

  navigate(routeRaw: IRouteRaw, startPoint: IPoint, endPoint: IPoint) {
    this.startPoint = startPoint
    this.endPoint = endPoint
    this.openNode = null
    this.closeList = []
    this.path = []
    const routeSegments = handleData(JSON.parse(JSON.stringify(routeRaw)), startPoint, endPoint)

    if (!routeSegments) return
    const graphList = toGraphStructure(routeSegments as ISegment[])
    deleteInvalidNode(graphList, startPoint, endPoint)
    const segmentNodes = graphList.map((item) => new Node(item, endPoint))
    this.nodes = segmentNodes
    segmentNodes[0].cost = 0
    this.openNode = segmentNodes[0]
    this.foundRoute()
  }

  foundRoute() {
    if (this.openNode) {
      const current = this.openNode
      // const nodes = current.children.map((item) => this.nodes.find((el) => el.id === item.id))
      const nodes = this.nodes.filter((item) => !this.closeList.includes(item) && current.children.some((el) => el.id === item.id))

      for (const node of nodes) {
        const index = current.children.findIndex((item) => item.id === node.id)
        const cost = current.cost + current.children[index].distance
        if (node.cost === null || cost < node.cost) {
          node.cost = cost
          node.parent = current
        }
      }

      this.closeList.push(current)
      this.openNode = null
      const path = this.#foundSmallestCostRoute()
      if (path) {
        return path
      }
    }
  }

  #foundSmallestCostRoute() {
    // 排除已经在关闭列表中的节点
    const okNodes = this.nodes.filter((item) => !this.closeList.includes(item))
    if (!okNodes.length) return
    // 找到代价存在且最小的节点
    const minCostNode = okNodes.reduce((prev, current) => {
      if (prev.cost === null) return current
      const currentTotalCost = current.cost + current.toEndDistance
      const prevTotalCost = prev.cost + prev.toEndDistance
      if (current.cost && currentTotalCost < prevTotalCost) return current
      return prev
    }, okNodes[0])

    // 如果最小节点是终点，则找到最短路径
    if (isPointEqual(minCostNode.point, this.endPoint)) {
      const path = this.#generatePath(minCostNode)
      this.path = path
      console.log(path)
      return path
    }

    this.openNode = minCostNode
    this.foundRoute()
  }

  #generatePath(node: Node) {
    const path = [node.point]
    let current = node
    while (current.parent) {
      path.push(current.parent.point)
      current = current.parent
    }

    path.reverse()
    return path
  }
}

export function handleData(routeRaw: IRouteRaw, startPoint?, endPoint?): ISegment[] | boolean {
  /**将线路数据处理成线段数组*/
  const segmentList: { start: IPoint; end: IPoint }[] = []
  for (const route of routeRaw) {
    for (let i = 0; i < route.length - 1; i++) {
      const start = route[i]
      const end = route[i + 1]
      segmentList.push({ start, end })
    }
  }

  /**记录线段交点*/
  const intersectData = new Map()
  function recordIntersectPointForSegment(segment, point) {
    const points = intersectData.get(segment)
    if (!points) {
      intersectData.set(segment, [point])
      return
    }

    /**避免重复记录*/
    if (points.some((el) => isPointEqual(el, point))) return
    if ([segment.start, segment.end].some((el) => isPointEqual(el, point))) return
    points.push(point)
  }

  const withoutElevatorSegments = segmentList.filter((item) => item.start.z === item.end.z)
  /**寻找交点*/
  for (const segment of withoutElevatorSegments) {
    const temp = [...withoutElevatorSegments.filter((item) => item.start.z === segment.start.z)]
    const index = withoutElevatorSegments.indexOf(segment)
    /**删除自身*/
    temp.splice(index, 1)
    for (const item of temp) {
      /**对比过后就删除，避免重复比较*/
      // const index = temp.indexOf(item)
      // temp.splice(index, 1)
      if (isLineContinuous(segment, item)) continue

      const point = linesIntersect(
        { x: segment.start.lat, y: segment.start.lng },
        { x: segment.end.lat, y: segment.end.lng },
        { x: item.start.lat, y: item.start.lng },
        { x: item.end.lat, y: item.end.lng }
      )
      if (!point) continue
      recordIntersectPointForSegment(segment, { ...point, z: segment.start.z })
      recordIntersectPointForSegment(item, { ...point, z: segment.start.z })
    }
  }

  /**根据交点重新拆分线段*/
  for (const [key, value] of intersectData.entries()) {
    // 根据与起始点位的距离进行排序
    value.sort((a, b) => {
      const distanceA = getDistance(a, key.start)
      const distanceB = getDistance(b, key.start)
      return distanceA - distanceB
    })
    const newPoints = [key.start, ...value, key.end]
    const newSegmentList = []
    for (let i = 0; i < newPoints.length - 1; i++) {
      const start = newPoints[i]
      const end = newPoints[i + 1]
      newSegmentList.push({ start, end })
    }

    segmentList.splice(segmentList.indexOf(key), 1, ...newSegmentList)
  }

  function handleStartAndEndPoint() {
    /**每条线段距离开始的距离*/
    const toStartPintDistanceList = []
    let withoutElevatorSegments = segmentList.filter((item) => item.start.z === item.end.z)
    const filteredListStart = withoutElevatorSegments.filter((item) => item.start.z === startPoint.z)
    if (!filteredListStart.length) {
      ElMessage.error('起点不在路线上')
      return false
    }

    for (const segment of filteredListStart) {
      const info = pointLineDistance(
        { x: startPoint.lat, y: startPoint.lng },
        { x: segment.start.lat, y: segment.start.lng },
        { x: segment.end.lat, y: segment.end.lng }
      )
      info.point.z = startPoint.z
      toStartPintDistanceList.push({ ...info, segment })
    }

    // 找出距离最小的数据
    let minDataStarts = toStartPintDistanceList.filter((item) => item.distance <= maxDistance)

    if (!minDataStarts.length) {
      ElMessage.error('起点不在路线上')
      return false
    }

    // 如果有垂直线段，则优先选择垂直线段
    if (minDataStarts.some((item) => item.isVertical)) {
      minDataStarts = minDataStarts.filter((item) => item.isVertical)
    }

    for (const minDataStart of minDataStarts) {
      const segmentStart = minDataStart.segment
      const index = segmentList.indexOf(segmentStart)
      console.log(index)
      segmentList.splice(index, 1, { start: segmentStart.start, end: minDataStart.point }, { start: minDataStart.point, end: segmentStart.end })
      // 将起点线段加入数据头部
      segmentList.unshift({ start: startPoint, end: minDataStart.point })
    }

    /**每条线段距离终点的距离*/
    const toEndPintDistanceList = []
    withoutElevatorSegments = segmentList.filter((item) => item.start.z === item.end.z)
    const filteredListEnd = withoutElevatorSegments.filter((item) => item.start.z === endPoint.z)
    if (!filteredListEnd.length) {
      ElMessage.error('终点不在路线上')
      return false
    }

    for (const segment of filteredListEnd) {
      const info = pointLineDistance(
        { x: endPoint.lat, y: endPoint.lng },
        { x: segment.start.lat, y: segment.start.lng },
        { x: segment.end.lat, y: segment.end.lng }
      )

      info.point.z = endPoint.z
      toEndPintDistanceList.push({ ...info, segment })
    }

    // 找出距离最小的数据
    let minDataEnds = toEndPintDistanceList.filter((item) => item.distance <= maxDistance)
    if (!minDataEnds.length) {
      ElMessage.error('终点不在路线上')
      return false
    }

    // 如果有垂直线段，则优先选择垂直线段
    if (minDataEnds.some((item) => item.isVertical)) {
      minDataEnds = minDataEnds.filter((item) => item.isVertical)
    }

    for (const minDataEnd of minDataEnds) {
      const segmentEnd = minDataEnd.segment
      segmentList.splice(
        segmentList.indexOf(segmentEnd),
        1,
        { start: segmentEnd.start, end: minDataEnd.point },
        { start: minDataEnd.point, end: segmentEnd.end }
      )
      // 将起点线段加入数据尾部
      segmentList.push({ start: minDataEnd.point, end: endPoint })
    }

    return true
  }

  let isOk = true

  if (startPoint && endPoint) {
    isOk = handleStartAndEndPoint()
  }

  for (const segment of segmentList) {
    segment.distance = getDistance(segment.start, segment.end)
  }

  // return segmentList.filter((item) => item.distance > 0)
  return isOk ? (segmentList as ISegment[]) : false
}

interface IGraphChildren {
  id: string
  type: number
  distance: number
}

interface IGraph {
  id: string
  point: IPoint
  children: IGraphChildren[]
}

/**
 * 将数据处理成图结构
 * ISegment[] -> IGraph[]
 * */
export function toGraphStructure(list: ISegment[]) {
  // 给list中的每个点添加id
  for (const item of list) {
    item.start.id = `${item.start.lat}-${item.start.lng}-${item.start.z}`
    item.end.id = `${item.end.lat}-${item.end.lng}-${item.end.z}`
  }

  const graphList: IGraph[] = []
  for (const item of list) {
    const start = item.start
    const end = item.end
    const distance = item.distance
    const startGraph = graphList.find((el) => el.id === start.id)
    if (!startGraph) {
      const point = { lat: start.lat, lng: start.lng, z: start.z }
      graphList.push({ point, children: [{ id: end.id, type: 1, distance }], id: start.id })
    } else {
      const child = startGraph.children.find((el) => isPointEqual(el.id, end))
      if (!child) {
        startGraph.children.push({ id: end.id, type: 1, distance })
      }
    }

    const endGraph = graphList.find((el) => el.id === end.id)
    if (!endGraph) {
      const point = { lat: end.lat, lng: end.lng, z: end.z }
      graphList.push({ point, children: [{ id: start.id, type: 1, distance }], id: end.id })
    } else {
      const child = endGraph.children.find((el) => isPointEqual(el.id, start))
      if (!child) {
        endGraph.children.push({ id: start.id, type: 1, distance })
      }
    }
  }

  return graphList
}

/**
 * 删除图结构中children长度为1且不是起点、终点的节点
 * */
export function deleteInvalidNode(graphList: IGraph[], startPoint: IPoint, endPoint: IPoint) {
  function getIndex() {
    return graphList.findIndex((item) => item.children.length === 1 && !isPointEqual(item.point, startPoint) && !isPointEqual(item.point, endPoint))
  }

  let index = getIndex()
  while (index > -1) {
    const item = graphList[index]
    graphList.splice(index, 1)
    graphList
      .filter((el) => el.children.some((child) => child.id === item.id))
      .forEach((el) => {
        const index = el.children.findIndex((child) => child.id === item.id)
        el.children.splice(index, 1)
      })
    index = getIndex()
  }
}

export let generator: Generator<Node, IPoint[], unknown>

export function getGenerator() {
  return generator
}

const popupOptions: L.PopupOptions = { autoClose: false, closeOnClick: false }
export class StepNavigateRoute {
  nodes: Node[] = []
  openNode: Node
  closeList: Node[] = []
  path: IPoint[] = []
  intersectMarkers = []
  lines: L.Polyline[] = []
  popups: L.Popup[] = []

  startPoint: IPoint
  endPoint: IPoint
  constructor() {}

  navigate(routeRaw: IRouteRaw, startPoint: IPoint, endPoint: IPoint) {
    this.startPoint = startPoint
    this.endPoint = endPoint
    this.openNode = null
    this.closeList = []
    this.path = []
    const routeSegments = handleData(JSON.parse(JSON.stringify(routeRaw)), startPoint, endPoint)

    if (!routeSegments) return
    const graphList = toGraphStructure(routeSegments as ISegment[])
    const mapStore = useMapStore()
    const map = toRaw(mapStore.map)
    deleteInvalidNode(graphList, startPoint, endPoint)
    const segmentNodes = graphList.map((item) => new Node(item, endPoint))
    const list = routeSegments.filter((item) => [item.start.z, item.end.z].includes(mapStore.floorHeight()))

    for (const [index, segment] of list.entries()) {
      // 根据index生成不同颜色
      const polyline = L.polyline([segment.start, segment.end], { color: generateColor(index * 40), weight: 5 }).addTo(map)
      const myIcon = L.divIcon({ className: 'line-icon', html: `${segment.distance}`, iconSize: [30, 30] })
      const marker = L.marker(polyline.getCenter(), { icon: myIcon }).addTo(map)
    }

    for (const [index, segmentNode] of segmentNodes.entries()) {
      const myIcon = L.divIcon({ className: 'my-div-icon', html: `${index}`, iconSize: [30, 30], popupAnchor: [0, -20] })
      // 你可以在 .my-div-icon CSS 中设置样式
      const marker = L.marker(segmentNode.point, { icon: myIcon }).addTo(map)
      if (segmentNode.point.z !== mapStore.floorHeight()) {
        marker.setOpacity(0)
      }

      this.intersectMarkers.push(marker)
    }

    this.nodes = segmentNodes
    segmentNodes[0].cost = 0
    this.openNode = segmentNodes[0]
    generator = this.foundRoute.call(this)
    generator.next()
    generator.next()
  }

  foundRoute = function* (this: StepNavigateRoute) {
    yield
    if (this.openNode) {
      this.#removeLines()
      const current = this.openNode
      // const nodes = current.children.map((item) => this.nodes.find((el) => el.id === item.id))
      const nodes = this.nodes.filter((item) => !this.closeList.includes(item) && current.children.some((el) => el.id === item.id))
      const mapStore = useMapStore()
      const index = this.nodes.findIndex((item) => item.id === current.id)
      const marker = this.intersectMarkers[index] as L.Marker
      marker.closePopup()
      const iconElement = marker.getElement() as HTMLDivElement
      iconElement.classList.remove('ripple')
      iconElement.style.backgroundColor = '#53e553'
      yield

      for (const node of nodes) {
        const nodeIndex = current.children.findIndex((item) => item.id === node.id)
        const cost = current.cost + current.children[nodeIndex].distance
        this.lines.push(L.polyline([current.point, node.point], { color: 'red', weight: 5 }).addTo(mapStore.map))
        if (node.cost === null || cost < node.cost) {
          node.cost = cost
          node.parent = current
          const markerIndex = this.nodes.findIndex((item) => item.id === node.id)
          const marker = this.intersectMarkers[markerIndex]
          marker.closePopup()
          const iconElement = marker.getElement() as HTMLDivElement
          const totalCost = node.cost + node.toEndDistance
          const popup = marker.bindPopup(`实际代价：${node.cost}预估代价：${node.toEndDistance}总代价：${totalCost}父节点：${index}号`, popupOptions)
          this.popups.push(popup)
          popup.openPopup()
          iconElement.style.backgroundColor = 'pink'
        }

        yield
      }

      iconElement.style.backgroundColor = '#ccc'
      this.closeList.push(current)
      this.openNode = null
      const path = this.#foundSmallestCostRoute()
      if (path) {
        return path
      }
    }
  }

  #removeLines() {
    for (const line of this.lines) {
      line.remove()
    }

    this.lines = []
  }

  #foundSmallestCostRoute() {
    // 排除已经在关闭列表中的节点
    const okNodes = this.nodes.filter((item) => !this.closeList.includes(item))
    if (!okNodes.length) return
    // 找到代价存在且最小的节点
    const minCostNode = okNodes.reduce((prev, current) => {
      if (prev.cost === null) return current
      const currentTotalCost = current.cost + current.toEndDistance
      const prevTotalCost = prev.cost + prev.toEndDistance
      if (current.cost && currentTotalCost < prevTotalCost) return current
      return prev
    }, okNodes[0])
    const markerIndex = this.nodes.findIndex((item) => item.id === minCostNode.id)
    const marker = this.intersectMarkers[markerIndex]
    const iconElement = marker.getElement() as HTMLDivElement

    // 如果最小节点是终点，则找到最短路径
    if (isPointEqual(minCostNode.point, this.endPoint)) {
      console.log(JSON.parse(JSON.stringify(this.nodes)))
      const path = this.#generatePath(minCostNode)
      this.path = path
      iconElement.style.backgroundColor = '#53e553'
      this.popups.forEach((item) => item.closePopup())
      this.#removeLines()
      const mapStore = useMapStore()
      const map = toRaw(mapStore.map)
      L.polyline(path, { color: 'red', weight: 5 }).addTo(map)

      return path
    }

    iconElement.classList.add('ripple')
    marker.closePopup()
    marker.openPopup()

    const mapStore = useMapStore()
    // L.circle(minCostNode.point, { color: 'green', radius: 5 }).addTo(mapStore.map)

    this.openNode = minCostNode
    generator = this.foundRoute.call(this)
    generator.next()
  }

  #generatePath(node: Node) {
    const path = [node.point]
    let current = node
    while (current.parent) {
      path.push(current.parent.point)
      current = current.parent
    }

    path.reverse()
    return path
  }
}
