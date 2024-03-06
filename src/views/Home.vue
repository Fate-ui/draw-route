<script lang="ts" setup>
import L from 'leaflet'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import 'highlight.js/styles/atom-one-dark.css'
import { useClipboard } from '@vueuse/core'
import { ElForm, ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import DrawLine from '@/views/DrawLine/DrawLine.vue'
import { NavigateRoute, StepNavigateRoute, getGenerator, handleData, viewSegments } from '@/views/NavigateRoute'
import { useMapStore } from '@/store/map'
import { ELEVATOR_GROUP_STORAGE_KEY, PATH_LOCALSTORAGE_KEY, getLineData } from '@/views/DrawLine'
import ShowArea from '@/views/ShowArea/Index.vue'

const drawLineRef = ref<InstanceType<typeof DrawLine>>()

hljs.registerLanguage('json', json)
const codeRef = shallowRef<HTMLElement>()
const showJSON = ref(false)
const data = ref()
const navigateRoute = new NavigateRoute()
function openJSONDialog() {
  title.value = '原始路线数据'
  data.value = getLineData()
  openDialog()
}

const title = ref('')
function openDialog() {
  showJSON.value = true
  if (codeRef.value?.dataset?.highlighted) return
  nextTick(() => {
    hljs.highlightAll()
  })
}

function openSegmentDialog() {
  title.value = '线段数据'
  // data.value = toGraphStructure(handleData(getLineData()))
  data.value = handleData(getLineData())
  // 将routeSegments数据处理成图结构

  openDialog()
}

function view3D() {
  localStorage.setItem(PATH_LOCALSTORAGE_KEY, '')
  router.push('/navigate')
}

/**
 * 复制功能
 * */
const clipboard = useClipboard({ source: data })
function copy() {
  clipboard.copy(JSON.stringify(data.value, null, 2))
  ElMessage.success({ message: '复制成功', grouping: true })
}

/**
 * 导入路劲
 * */
const showImport = ref(false)
const importData = ref({ path: '' })
const rules = {
  path: [{ required: true, message: '请输入路径', trigger: 'blur' }]
}
function openImportDialog() {
  showImport.value = true
}

const formRef = shallowRef<InstanceType<typeof ElForm>>()
function confirm() {
  formRef.value.validate((valid) => {
    if (valid) {
      const path = new Function(`return ${importData.value.path}`)()
      localStorage.setItem(PATH_LOCALSTORAGE_KEY, JSON.stringify(path))
      router.push('/navigate')
    }
  })
}

function stringToFn(str: string) {
  return new Function(`return ${str}`)()
}

const showNavigate = ref(false)
const navigateData = ref({ start: '', end: '' })
// const navigateData = ref({ start: '{"lat":1288,"lng":1059,"z":500}', end: '{"lat":1472,"lng":100,"z":500}' })
const navigateRules = {
  start: [{ required: true, message: '请输入起点', trigger: 'blur' }],
  end: [{ required: true, message: '请输入终点', trigger: 'blur' }]
}
function navigate() {
  showNavigate.value = true
}

const formRef2 = shallowRef<InstanceType<typeof ElForm>>()
const loading = ref(false)
const router = useRouter()
const mapStore = useMapStore()
function confirmNavigate() {
  formRef2.value.validate((valid) => {
    if (valid) {
      const pre = performance.now()
      navigateRoute.navigate(getLineData(), stringToFn(navigateData.value.start), stringToFn(navigateData.value.end))
      console.log(navigateRoute.path)
      console.log('耗时', performance.now() - pre)
      localStorage.setItem(PATH_LOCALSTORAGE_KEY, JSON.stringify(navigateRoute.path))
      if (navigateRoute.path.length === 1) {
        ElMessage.error({ message: '无法生成路径', grouping: true })
        return
      }

      navigateRoute.path.length && router.push('/navigate')
    }
  })
}

/**
 * 寻路算法跟进
 * */
const { showNextButton } = storeToRefs(mapStore)
const stepNavigateRoute = new StepNavigateRoute()
function stepNavigate() {
  formRef2.value.validate((valid) => {
    if (valid) {
      showNavigate.value = false
      showNextButton.value = true
      stepNavigateRoute.navigate(getLineData(), stringToFn(navigateData.value.start), stringToFn(navigateData.value.end))
      // drawLineRef.value.drawLine(navigateRoute.path)
      if (stepNavigateRoute.path.length === 1) {
        ElMessage.error({ message: '无法生成路径', grouping: true })
        return
      }
    }
  })
}

function next() {
  const generator = getGenerator()
  generator.next()
}

/**添加电梯*/
let elevatorPosition = null
const showElevatorDialog = ref(false)
const elevatorGroups = ref([])
const filteredElevatorGroups = computed(() => elevatorGroups.value.filter((item) => !item.list.some((i) => i.z === mapStore.floorHeight())))
const elevatorData = ref({ name: '', group: '' })
function elevatorAdd(e) {
  const latLng = e.layer.getLatLng()
  elevatorPosition = { lat: latLng.lat, lng: latLng.lng, z: mapStore.floorHeight() }
  elevatorGroups.value = JSON.parse(localStorage.getItem(ELEVATOR_GROUP_STORAGE_KEY)) || []
  elevatorData.value = { name: '', group: '' }
  showElevatorDialog.value = true
}

function elevatorNameChange() {
  elevatorData.value.group = null
}

function elevatorGroupChange() {
  elevatorData.value.name = null
}

function confirmElevator() {
  if (elevatorData.value.name) {
    const group = {
      name: elevatorData.value.name,
      list: [elevatorPosition]
    }
    elevatorGroups.value.push(group)
    localStorage.setItem(ELEVATOR_GROUP_STORAGE_KEY, JSON.stringify(elevatorGroups.value))
  } else if (elevatorData.value.group) {
    const group = elevatorGroups.value.find((item) => item.name === elevatorData.value.group)
    group.list.push(elevatorPosition)
    localStorage.setItem(ELEVATOR_GROUP_STORAGE_KEY, JSON.stringify(elevatorGroups.value))
  } else {
    ElMessage.error({ message: '请选择组', grouping: true })
    return
  }

  drawLineRef.value.saveElevator()
  showElevatorDialog.value = false
}
</script>
<template>
  <DrawLine ref="drawLineRef" @elevatorAdd="elevatorAdd" />
  <div class="fixed top-20px right-20px px-12px py-6px flex items-center z-999">
    <el-button type="primary" @click="openJSONDialog">查看原始线路</el-button>
    <el-button type="primary" @click="openSegmentDialog">查看线段数据</el-button>
    <el-button type="primary" @click="viewSegments()">查看线路分段</el-button>
    <el-button type="primary" @click="view3D">3D线路</el-button>
    <ShowArea class="mr-12px" />
    <el-button type="primary" @click="openImportDialog">导入线路</el-button>
    <el-button type="primary" @click="navigate">导航</el-button>
  </div>
  <div class="fixed top-20px left-120px px-12px py-6px flex items-center z-999">
    <el-button v-if="showNextButton" plain type="primary" @click="next">下一步</el-button>
  </div>
  <el-dialog v-model="showJSON" align-center :title="title" destroy-on-close>
    <el-button type="primary" @click="copy">复制</el-button>
    <pre class="max-h-80vh overflow-y-scroll">
      <code ref="codeRef" style="font-family: 'Cascadia Code','Consolas',serif">{{ data }}</code>
    </pre>
  </el-dialog>
  <el-dialog v-model="showNavigate" width="20vw" align-center title="导航" destroy-on-close>
    <el-form ref="formRef2" :model="navigateData" :rules="navigateRules">
      <el-form-item label="起点" prop="start">
        <el-input v-model="navigateData.start" placeholder="请输入起点" />
      </el-form-item>
      <el-form-item label="终点" prop="end">
        <el-input v-model="navigateData.end" placeholder="请输入终点" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button v-loading.fullscreen.lock="loading" type="primary" @click="stepNavigate">步进寻路</el-button>
      <el-button v-loading.fullscreen.lock="loading" type="primary" @click="confirmNavigate">确定</el-button>
    </template>
  </el-dialog>
  <el-dialog v-model="showImport" title="导入线路数据" destroy-on-close>
    <el-form ref="formRef" :model="importData" :rules="rules">
      <el-form-item prop="path">
        <el-input v-model="importData.path" />
      </el-form-item>
      <!--      <span class="mt-16px text-#bbb"> 提示：数据格式为二维坐标数组，如： [ [45.51, -122.68], [37.77, -122.43], [34.04, -118.2] ] </span>-->
      <span class="mt-16px text-#bbb">
        提示：数据格式为坐标数组，如： [ { lat: 1534, lng: 260, z: 0 }, { lat: 1539, lng: 569, z: 250 }, { lat: 1346, lng: 575, z: 250 } ]
      </span>
    </el-form>
    <template #footer>
      <el-button type="primary" @click="confirm">确定</el-button>
    </template>
  </el-dialog>
  <el-dialog v-model="showElevatorDialog" title="选择组" width="30vw">
    <el-form :model="elevatorData">
      <el-form-item label="新建分组并加入" prop="name">
        <el-input v-model="elevatorData.name" placeholder="请输入组名" @change="elevatorNameChange" />
      </el-form-item>
      <el-form-item label="选择已有分组" prop="group">
        <el-select v-model="elevatorData.group" @change="elevatorGroupChange">
          <el-option v-for="item in filteredElevatorGroups" :key="item.name" :label="item.name" :value="item.name" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button type="primary" @click="confirmElevator">确定</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss"></style>
