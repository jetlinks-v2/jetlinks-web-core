import { useCaptchaVerify } from '../src/hooks/useCaptchaVerify'

const plain = useCaptchaVerify<string>()
const result: Promise<string> = plain.openCaptcha()
plain.onCaptchaSuccess('captcha-id')
plain.captchaOpen.value = false
// @ts-expect-error Verification results retain the caller's type.
plain.onCaptchaSuccess(true)

const proof = useCaptchaVerify<{ proof: string; expiresAt: number }, { token: string }>()
proof.openCaptcha({ context: { token: 'context' }, signal: new AbortController().signal })
proof.onCaptchaSuccess({ proof: 'value', expiresAt: Date.now() })
const context: { token: string } | undefined = proof.context.value
// @ts-expect-error Context does not accept another provider's shape.
proof.openCaptcha({ context: { key: 'other-context' } })
// @ts-expect-error Proof structure is not erased by the generic hook.
proof.onCaptchaSuccess('captcha-id')

void result
void context
