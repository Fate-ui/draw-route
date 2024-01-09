<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { disposeThreeJs } from '@/utils'
import { useMapStore } from '@/store/map'
import { PATH_LOCALSTORAGE_KEY, getLineData } from '@/views/DrawLine'

const size = { width: window.innerWidth, height: window.innerHeight }

const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(45, size.width / size.height, 1, 10000)
camera.position.set(0, 1300, 1400)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(size.width, size.height)
renderer.setPixelRatio(window.devicePixelRatio)
const containerRef = shallowRef<HTMLDivElement>()
onMounted(() => {
  containerRef.value.appendChild(renderer.domElement)
})

const controls = new OrbitControls(camera, renderer.domElement)
renderer.setAnimationLoop(() => {
  controls.update()
  renderer.render(scene, camera)
})

const showGrid = ref(false)
const axesHelper = new THREE.AxesHelper(10000)
scene.add(axesHelper)

showGridChange()
function showGridChange() {
  axesHelper.visible = !!showGrid.value
}

const material = new THREE.LineBasicMaterial({
  color: new THREE.Color('#3388FF'),
  linewidth: 10
})

const group = new THREE.Group()
const lineData = getLineData()
for (const line of lineData) {
  const points = []
  for (const point of line) {
    points.push(new THREE.Vector3(point.lng, point.lat, point.z))
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points)

  const lineObject = new THREE.Line(geometry, material)
  group.add(lineObject)
}

group.rotation.set(-Math.PI / 2, 0, 0)
scene.add(group)

const pathMaterial = new THREE.LineBasicMaterial({
  color: new THREE.Color('red'),
  linewidth: 10
})
const path = JSON.parse(localStorage.getItem(PATH_LOCALSTORAGE_KEY) || '[]')
if (path) {
  const points = []
  for (const point of path) {
    points.push(new THREE.Vector3(point.lng, point.lat, point.z))
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points)

  const lineObject = new THREE.Line(geometry, pathMaterial)
  group.add(lineObject)
}

/**
 * 包围盒全自动计算：模型整体居中
 */
const box3 = new THREE.Box3()
// 计算层级模型group的包围盒
// 模型group是加载一个三维模型返回的对象，包含多个网格模型
box3.expandByObject(group)
// 计算一个层级模型对应包围盒的几何体中心在世界坐标中的位置
const center = new THREE.Vector3()
box3.getCenter(center)
// console.log('查看几何体中心坐标', center);

// 重新设置模型的位置，使之居中。
group.position.x = group.position.x - center.x
group.position.y = group.position.y - center.y
group.position.z = group.position.z - center.z
onUnmounted(() => {
  disposeThreeJs(scene, renderer)
})
</script>

<template>
  <div ref="containerRef" />
  <div class="fixed right-20px top-20px z-999">
    <el-form-item label="坐标轴：">
      <el-switch v-model="showGrid" @change="showGridChange" />
    </el-form-item>
  </div>
</template>

<style scoped lang="scss">
:deep(.el-form-item__label) {
  color: white;
}
</style>
