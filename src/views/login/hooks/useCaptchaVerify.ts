import { ref } from 'vue'

export function useCaptchaVerify() {
  const captchaOpen = ref(false)
  // Store promise resolvers
  let resolveFn: ((value: any) => void) | null = null
  let rejectFn: ((reason?: any) => void) | null = null

  /**
   * Opens the captcha and returns a promise that resolves when verification is successful.
   */
  const openCaptcha = () => {
    captchaOpen.value = true
    return new Promise((resolve, reject) => {
      resolveFn = resolve
      rejectFn = reject
    })
  }

  /**
   * Callback for when captcha verification is successful.
   * @param data The verification data returned by the captcha component
   */
  const onCaptchaSuccess = (data: any) => {
    captchaOpen.value = false
    if (resolveFn) {
      resolveFn(data)
      // Reset
      resolveFn = null
      rejectFn = null
    }
  }

  /**
   * Optional: Handle manual closure or cancellation
   */
  const closeCaptcha = () => {
    if (captchaOpen.value) {
      captchaOpen.value = false
      if (rejectFn) {
        rejectFn(new Error('Captcha closed by user'))
        resolveFn = null
        rejectFn = null
      }
    }
  }

  return {
    captchaOpen,
    openCaptcha,
    onCaptchaSuccess,
    closeCaptcha
  }
}
