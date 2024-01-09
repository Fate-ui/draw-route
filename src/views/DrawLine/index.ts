import L from 'leaflet'
import elevator from '@/assets/elevator.svg'
import { allFloors, useMapStore } from '@/store/map'

export const elevatorIcon = L.icon({
  iconUrl: elevator,
  iconSize: [50, 50],
  iconAnchor: [25, 25]
})

export const PATH_LOCALSTORAGE_KEY = 'PATH_DATA_KEY'
export const ELEVATOR_GROUP_STORAGE_KEY = 'ELEVATOR_GROUP_STORAGE_KEY'

export const ELEVATOR_NAME = 'Elevator'
export function addCustomControl(map: L.Map) {
  /** 添加电梯按钮*/
  const elevatorControl = map.pm.Toolbar.copyDrawControl('Marker', {
    name: ELEVATOR_NAME,
    block: 'draw',
    title: '绘制电梯',
    actions: ['cancel'],
    className: 'elevator-icon'
  })

  const options: L.PM.DrawModeOptions = { markerStyle: { icon: elevatorIcon }, snapDistance: 25 }
  elevatorControl.drawInstance.setOptions(options)
}

export const pathOptions: L.PathOptions = { color: '#3388FF', weight: 3, lineCap: 'square' }

const LINE_DATA_KEY = 'LINE_DATA_KEY'
export function getLineData() {
  /**给坐标数据添加z坐标*/
  const res = []
  const allDataObject = JSON.parse(localStorage.getItem(LINE_DATA_KEY) || '{}')

  const mapStore = useMapStore()
  for (const resKey in allDataObject) {
    const z = mapStore.floorHeightByName(resKey)
    const data = allDataObject[resKey].map((item) => item.map((el) => ({ ...el, z })))
    data.length && res.push(...data)
  }

  /**处理电梯数据*/
  const elevatorGroups = JSON.parse(localStorage.getItem(ELEVATOR_GROUP_STORAGE_KEY) || '[]')
  for (const group of elevatorGroups) {
    const list = group.list
    if (list.length <= 1) continue
    // 根据z值排序
    list.sort((a, b) => a.z - b.z)
    res.push(list)
  }

  return res
}

export class LineService {
  LOCALSTORAGE_KEY = LINE_DATA_KEY
  allDataObject = JSON.parse(localStorage.getItem(this.LOCALSTORAGE_KEY) || '{}')
  dataList = []

  constructor() {
    this.updateDataList()
  }

  updateDataList = () => {
    const mapStore = useMapStore()
    this.dataList = this.allDataObject[allFloors[mapStore.currentFloor]] || []
  }

  showBeforeData() {
    const mapStore = useMapStore()
    for (const latLng of this.dataList) {
      const polyline = L.polyline(latLng, pathOptions).addTo(toRaw(mapStore.map))
      this.registerEvents(polyline.pm._layer)
    }
  }

  onCreate = (e) => {
    const latLng = e.layer.getLatLngs()
    this.registerEvents(e.layer)
    this.dataList.push(latLng)
    this.updateLocalStorage()
  }

  onRemove = (e) => {
    const index = this.getIndex(e.layer.getLatLngs())
    index > -1 && this.dataList.splice(index, 1)
    this.updateLocalStorage()
  }

  registerEvents = (layer) => {
    let latLng = [...layer.getLatLngs()]
    const updateLatLng = (e) => {
      const index = this.getIndex(latLng)
      const newLatLng = e.layer.getLatLngs()
      index > -1 && this.dataList.splice(index, 1, newLatLng)
      latLng = newLatLng
      this.updateLocalStorage()
    }

    const deleteLatLng = () => {
      const index = this.getIndex(latLng)
      index > -1 && this.dataList.splice(index, 1)
      this.updateLocalStorage()
    }

    /**编辑过程中删除点位*/
    layer.on('pm:vertexremoved', (e) => {
      if (e.layer.getLatLngs().length <= 0) {
        deleteLatLng()
      } else {
        updateLatLng(e)
      }
    })

    layer.on('pm:markerdragend', updateLatLng)

    layer.on('pm:intersect', (e) => {
      console.log('intersect is not logged', e)
    })
  }

  getIndex(latLngs) {
    const index = this.dataList.findIndex((item) => JSON.stringify(item) === JSON.stringify(latLngs))
    return index
  }

  updateLocalStorage() {
    const mapStore = useMapStore()
    this.allDataObject[allFloors[mapStore.currentFloor]] = this.dataList
    localStorage.setItem(this.LOCALSTORAGE_KEY, JSON.stringify(this.allDataObject))
  }
}

export class MarkerService {
  LOCALSTORAGE_KEY = 'MARKER_DATA_KEY'
  allDataObject = JSON.parse(localStorage.getItem(this.LOCALSTORAGE_KEY) || '{}')
  dataList = []

  constructor() {
    this.updateDataList()
  }

  updateDataList = () => {
    const mapStore = useMapStore()
    this.dataList = this.allDataObject[allFloors[mapStore.currentFloor]] || []
  }

  showBeforeData() {
    const mapStore = useMapStore()
    for (const latLng of this.dataList) {
      const marker = L.marker(latLng).addTo(toRaw(mapStore.map))
      marker.bindPopup(`坐标：${JSON.stringify({ ...marker.getLatLng(), z: mapStore.floorHeight() })}`)
      this.registerEvents(marker.pm._layer, marker)
    }
  }

  onCreate = (e) => {
    const latLng = e.layer.getLatLng()
    const marker = e.marker
    const mapStore = useMapStore()
    marker.bindPopup(`坐标：${JSON.stringify({ ...marker.getLatLng(), z: mapStore.floorHeight() })}`)
    this.dataList.push(latLng)
    this.registerEvents(e.layer, marker)
    this.updateLocalStorage()
  }

  onRemove = (e) => {
    const index = this.getIndex(e.layer.getLatLng())
    index > -1 && this.dataList.splice(index, 1)
    this.updateLocalStorage()
  }

  registerEvents = (layer, marker) => {
    let latLng = layer.getLatLng()
    const updateLatLng = (e) => {
      const index = this.getIndex(latLng)
      console.log(index)
      const newLatLng = e.layer.getLatLng()
      this.dataList.splice(index, 1, newLatLng)
      latLng = newLatLng
      const mapStore = useMapStore()
      marker.bindPopup(`坐标：${JSON.stringify({ ...marker.getLatLng(), z: mapStore.floorHeight() })}`)
      this.updateLocalStorage()
    }

    layer.on('pm:dragend', updateLatLng)
  }

  getIndex(latLng) {
    const index = this.dataList.findIndex((item) => item.lat === latLng.lat && item.lng === latLng.lng)
    return index
  }

  updateLocalStorage() {
    const mapStore = useMapStore()
    this.allDataObject[allFloors[mapStore.currentFloor]] = this.dataList
    localStorage.setItem(this.LOCALSTORAGE_KEY, JSON.stringify(this.allDataObject))
  }
}

export class ElevatorMarkerService {
  LOCALSTORAGE_KEY = 'ELEVATOR_MARKER_DATA_KEY'
  allDataObject = JSON.parse(localStorage.getItem(this.LOCALSTORAGE_KEY) || '{}')
  dataList = []

  constructor() {
    this.updateDataList()
  }

  updateDataList = () => {
    const mapStore = useMapStore()
    this.dataList = this.allDataObject[allFloors[mapStore.currentFloor]] || []
  }

  showBeforeData() {
    const mapStore = useMapStore()
    for (const latLng of this.dataList) {
      const marker = L.marker(latLng, { icon: elevatorIcon }).addTo(toRaw(mapStore.map))
      marker.pm._shape = ELEVATOR_NAME
      this.registerEvents(marker.pm._layer)
    }
  }

  onCreate = (e) => {
    const latLng = e.layer.getLatLng()
    this.dataList.push(latLng)
    this.registerEvents(e.layer)
    this.updateLocalStorage()
  }

  onRemove = (e) => {
    const latLng = e.layer.getLatLng()
    const index = this.getIndex(latLng)
    index > -1 && this.dataList.splice(index, 1)
    this.updateLocalStorage()
    this.updateElevatorGroupStorage(latLng)
  }

  registerEvents = (layer) => {
    let latLng = layer.getLatLng()
    const updateLatLng = (e) => {
      const index = this.getIndex(latLng)
      const newLatLng = e.layer.getLatLng()
      this.dataList.splice(index, 1, newLatLng)
      latLng = newLatLng
      this.updateLocalStorage()
      this.updateElevatorGroupStorage(latLng)
    }

    layer.on('pm:dragend', updateLatLng)
  }

  getIndex(latLng) {
    const index = this.dataList.findIndex((item) => item.lat === latLng.lat && item.lng === latLng.lng)
    return index
  }

  updateLocalStorage() {
    const mapStore = useMapStore()
    this.allDataObject[allFloors[mapStore.currentFloor]] = this.dataList
    localStorage.setItem(this.LOCALSTORAGE_KEY, JSON.stringify(this.allDataObject))
  }

  updateElevatorGroupStorage(lagLng) {
    const mapStore = useMapStore()
    const elevatorGroups = JSON.parse(localStorage.getItem(ELEVATOR_GROUP_STORAGE_KEY)) || []
    let outIndex = -1
    let innerIndex = -1
    for (const [i, group] of elevatorGroups.entries()) {
      innerIndex = group.list.findIndex((item) => item.lat === lagLng.lat && item.lng === lagLng.lng && item.z === mapStore.floorHeight())
      if (innerIndex > -1) {
        outIndex = i
        break
      }
    }

    if (outIndex > -1) {
      outIndex > -1 && elevatorGroups[outIndex].list.splice(innerIndex, 1)
      localStorage.setItem(ELEVATOR_GROUP_STORAGE_KEY, JSON.stringify(elevatorGroups))
    }
  }
}
