import { toRaw } from 'vue'
import { acceptHMRUpdate, defineStore } from 'pinia'
import L from 'leaflet'
import { emitter } from '@/utils/mitt'

/**楼高*/
export const FLOOR_HEIGHT = 250
export const allFloors = ['B1', 'F1', 'F2']
export const mapBounds: L.LatLngBoundsExpression = [
  [0, 0],
  [2560, 1460]
]
export const useMapStore = defineStore({
  id: 'map',
  state: () => ({
    map: null as L.Map,
    currentFloor: 2,
    center: [1074, 498] as L.LatLngTuple,
    showNextButton: false
  }),
  getters: {},
  actions: {
    init(id: string) {
      const map = L.map(id, {
        // center: [30.62298671312932, 103.98499488830566],
        center: this.center, //地图中心点
        zoom: 1,
        zoomControl: false,
        crs: L.CRS.Simple,
        // maxBounds: mapBounds,
        minZoom: -1,
        maxZoom: 6,
        attributionControl: false // 版权控件
      })
      this.map = map

      //加载高德地图
      // L.tileLayer('http://wprd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scl=1&style=7&x={x}&y={y}&z={z}', {
      //   tileSize: 256,
      //   attribution:
      //     '<img src="https://webapi.amap.com/theme/v2.0/logo@2x.png" style="width: 73px; height: 20px; vertical-align: middle" / > &copy; 2022 AutoNavi - GS(2021)6375号'
      // }).addTo(map)
      // 加载图片图层
      L.imageOverlay(`${allFloors[this.currentFloor]}.svg`, mapBounds).addTo(map)
      watch(
        () => this.currentFloor,
        (val, oldValue) => {
          this.floorChange(val, oldValue)
        },
        { flush: 'sync' }
      )
      return map
    },

    floorChange(floor: number, oldValue: number) {
      const map = toRaw(this.map)
      map.eachLayer((layer: L.Marker) => {
        layer?.unbindPopup()
        layer?.remove()
      })

      L.imageOverlay(`${allFloors[this.currentFloor]}.svg`, mapBounds).addTo(map)
      emitter.emit('floorChange', floor)
    },

    floorHeightByName(floor: string): number {
      return allFloors.indexOf(floor) * FLOOR_HEIGHT
    },

    floorHeight(): number {
      return this.currentFloor * FLOOR_HEIGHT
    }
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMapStore, import.meta.hot))
}
