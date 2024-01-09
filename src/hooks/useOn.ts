import { tryOnScopeDispose } from '@vueuse/core'

/**
 * @note 此函数不用于注册DOM事件，注册DOM事件请使用useEventListener
 * @remarks 此函数针对那些“通过on和off来注册和关闭事件”的场景，在组件销毁时自动调用off，并且返回了stop函数用于停止监听
 * */
export function useOn(target, event: string, listener: any) {
  //target上必须有on和off方法
  function checkTarget(target) {
    if (!target.on || typeof target.on !== 'function') {
      console.warn(`${target}上不存在on方法`)
      return
    }

    if (!target.off || typeof target.off !== 'function') {
      console.warn(`${target}上不存在off方法`)
      return
    }
  }

  let cleanup = () => {}

  const stopWatch = watch(
    () => unref(target),
    (val) => {
      cleanup()
      checkTarget(val)
      val.on(event, listener)
      cleanup = () => {
        val.off(event, listener)
        cleanup = () => {}
      }
    },
    { immediate: true, flush: 'post' }
  )

  const stop = () => {
    stopWatch()
    cleanup()
    console.count('停止监听次数：')
  }

  //组件销毁后，取消监听
  tryOnScopeDispose(stop)

  return stop
}
