<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { Minus, Plus } from '@element-plus/icons-vue'
import { allFloors, mapBounds, useMapStore } from '@/store/map'

const mapStore = useMapStore()
const { currentFloor } = storeToRefs(mapStore)
const map = computed(() => mapStore.map)
const zoomInDisabled = computed(() => map.value?.getZoom() === map.value?.getMaxZoom())
const zoomOutDisabled = computed(() => map.value?.getZoom() === map.value?.getMinZoom())
//总的楼层数
const floorNum = ref([...allFloors].reverse())
//去往点击楼层
function goToFloor(floor: number) {
  currentFloor.value = floor
}

//去往上层或下层
function goUpNextFloor(val: number) {
  const oldIndex = currentFloor.value
  const curIndex = oldIndex - val
  currentFloor.value = curIndex
  //当到达最高楼层时，自动回到第一层，当到达最低楼层时，自动回到最后一层
  if (curIndex === -1) {
    currentFloor.value = allFloors.length - 1
  } else if (curIndex === floorNum.value.length) {
    currentFloor.value = 0
  }
}

//地图缩放
function handleZoomIn() {
  mapStore.center ? map.value.setView(mapStore.center, map.value.getZoom() + 1) : map.value.zoomIn()
}

function handleZoomOut() {
  mapStore.center ? map.value.setView(mapStore.center, map.value.getZoom() - 1) : map.value.zoomOut()
}

/*回复到地图原位置*/
function locate() {
  // map.value.fitBounds(mapBounds)
  map.value.setZoom(1)
  map.value.setView([1074, 498])
  // map.setView([30.625762, 103.985827], map.getZoom())
}
</script>

<template>
  <div class="floor-panel">
    <!--    选择楼层按钮-->
    <div class="floor">
      <button class="item" @click="goUpNextFloor(-1)">
        <SvgIcon name="up" text="18px" />
      </button>
      <button
        v-for="(item, index) in floorNum"
        :key="item"
        class="item"
        :class="{ active: allFloors.length - 1 - index == currentFloor }"
        @click="goToFloor(allFloors.length - 1 - index)"
      >
        {{ item }}
      </button>
      <button class="item" @click="goUpNextFloor(1)">
        <SvgIcon name="up" class="rotate-180" text="18px" />
      </button>
    </div>
    <!--    定位按钮-->
    <div
      class="absolute -bottom-70px left-0 right-0 grid place-items-center ma bg-#fafafa w-30px h-30px rounded-4px cursor-pointer"
      text="22px #999"
      hover="opacity-70"
      @click="locate"
    >
      <SvgIcon name="locate-center" />
    </div>
    <!--    底部缩放按钮-->
    <div
      flex="~ col"
      class="absolute -bottom-150px right-0 left-0 ma w-30px h-60px bg-#fafafa rounded-4px items-center justify-center cursor-pointer shadow-up"
    >
      <el-icon :class="{ 'opacity-70 cursor-default': zoomInDisabled }" class="border-b-1px border-#b3b3b3 border-b-dashed grow" @click="handleZoomIn">
        <Plus />
      </el-icon>
      <el-icon :class="{ 'opacity-70 cursor-default': zoomOutDisabled }" class="grow" @click="handleZoomOut"><Minus /></el-icon>
    </div>
  </div>
</template>

<style scoped lang="scss">
.floor-panel {
  .floor {
    .item {
      display: grid;
      place-items: center;
      width: 38px;
      height: 20px;
      background: #fafafa;
      margin-bottom: 8px;
      border: none;
      border-radius: 2px;
      box-shadow: 0px 0px 2px 0px rgba(0, 0, 0, 0.16);
      font-size: 12px;
      color: #999999;
      letter-spacing: 1.6px;
      cursor: pointer;
      &:hover {
        opacity: 0.7;
      }
      &.active {
        background-color: var(--el-color-primary);
        color: #ffffff;
      }
    }
  }
}
</style>
