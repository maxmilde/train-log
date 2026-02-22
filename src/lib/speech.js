/**
 * Web Speech API wrapper.
 * iOS Safari: speechSynthesis.speak() MUST be called inside a user gesture handler.
 * The timer's Start button press satisfies this. Do NOT call from useEffect/setInterval directly.
 */
export function speak(text) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.rate   = 0.85
  utt.pitch  = 1.0
  utt.volume = 1.0
  window.speechSynthesis.speak(utt)
}
