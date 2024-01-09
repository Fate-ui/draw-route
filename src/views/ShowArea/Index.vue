<script setup lang="ts">
import { ElForm } from 'element-plus'
import L from 'leaflet'
import { useMapStore } from '@/store/map'

const data = ref({
  radius: 100,
  point: ''
})
const rules = {
  radius: [{ required: true, message: '请输入半径', trigger: 'blur' }],
  point: [{ required: true, message: '请输入点位', trigger: 'blur' }]
}
const mapStore = useMapStore()

const showDialog = ref(false)
const formRef = shallowRef<InstanceType<typeof ElForm>>()
let circle: L.Circle
function confirm() {
  formRef.value.validate((valid) => {
    if (valid) {
      circle?.remove()
      const latLng = new Function(`return ${data.value.point}`)()
      circle = L.circle([latLng.lat, latLng.lng], { radius: data.value.radius }).addTo(mapStore.map)
      showDialog.value = false
    }
  })
}
</script>

<template>
  <el-button type="primary" v-bind="$attrs" @click="showDialog = true">范围测试</el-button>
  <el-dialog v-model="showDialog" width="30vw">
    <el-form ref="formRef" :model="data" :rules="rules">
      <el-form-item label="起点" prop="point">
        <el-input v-model="data.point" placeholder="请输入点位" />
      </el-form-item>
      <el-form-item label="半径" prop="radius">
        <el-input-number v-model="data.radius" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button type="primary" @click="confirm">确定</el-button>
      <el-button @click="showDialog = false">取消</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss"></style>
