<script lang="ts" setup>
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import { useMapStore } from '@/store/map'
import { ELEVATOR_NAME, ElevatorMarkerService, LineService, MarkerService, addCustomControl, pathOptions } from '@/views/DrawLine/index'
import { emitter } from '@/utils/mitt'

const emit = defineEmits<{
  elevatorAdd: any
}>()

onMounted(() => {
  init()
  showBeforeData()
  initDrawEditor()
})

let map: L.Map
const mapStore = useMapStore()
function init() {
  map = mapStore.init('leaflet')
}

const lineService = new LineService()
const markerService = new MarkerService()
const elevatorMarkerService = new ElevatorMarkerService()

emitter.on('floorChange', (val) => {
  lineService.updateDataList()
  markerService.updateDataList()
  elevatorMarkerService.updateDataList()
  showBeforeData()
})

function showBeforeData() {
  lineService.showBeforeData()
  markerService.showBeforeData()
  elevatorMarkerService.showBeforeData()
}

function initDrawEditor() {
  map.pm.addControls({
    position: 'topleft',
    drawCircleMarker: false,
    rotateMode: false,
    drawRectangle: false,
    drawPolygon: false,
    drawCircle: false,
    drawText: false,
    cutPolygon: false,
    dragMode: false
  })
  map.pm.setGlobalOptions({ snapDistance: 15, continueDrawing: true, snapMiddle: true, allowSelfIntersectionEdit: true, pathOptions })
  addCustomControl(map)
  map.pm.setLang('zh')
  map.on('pm:create', (e) => {
    switch (e.shape) {
      case 'Line':
        lineService.onCreate(e)
        break
      case 'Marker':
        markerService.onCreate(e)
        break
      case ELEVATOR_NAME:
        createElevatorEvent = e
        emit('elevatorAdd', e)
        break
    }
  })

  map.on('pm:remove', (e) => {
    switch (e.shape) {
      case 'Line':
        lineService.onRemove(e)
        break
      case 'Marker':
        markerService.onRemove(e)
        break
      case ELEVATOR_NAME:
        elevatorMarkerService.onRemove(e)
        break
    }
  })
}

let polyline: L.Polyline
function drawLine(latLng) {
  if (polyline) {
    polyline.remove()
  }

  if (!latLng?.length) return

  polyline = L.polyline(latLng, { color: 'red', weight: 5 }).addTo(map)
  // zoom the map to the polyline
  map.fitBounds(polyline.getBounds())
}

function clearPolyline() {
  polyline && polyline.remove()
}

let createElevatorEvent = null
function saveElevator() {
  elevatorMarkerService.onCreate(createElevatorEvent)
}

// onUnmounted(() => {
//   map.pm.removeControls()
//   map.remove()
// })

defineExpose({
  drawLine,
  clearPolyline,
  saveElevator
})
</script>
<template>
  <div id="leaflet" class="w-screen h-screen" />
  <FloorPanel class="fixed z-999 bottom-220px right-20px" />
</template>

<style scoped lang="scss"></style>
