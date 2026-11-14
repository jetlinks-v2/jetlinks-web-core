/** Visual input accepts only operators represented by the structured grammar; text literals keep native input. */
export function unsupportedMathKey(key:string,previous:string,textMode=false) {
  if(textMode)return false
  return /^[\\^_\[\]{}:;?~`$@#]$/.test(key) || /[《》≪≫∑∏∫∞≈≃≡∈∉⊂⊃∪∩]/u.test(key)
    || (key === '>' || key === '<') && previous.trim() === key
}
