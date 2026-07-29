import '@testing-library/jest-dom/vitest'
import i18n from '../i18n'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

Object.defineProperty(Element.prototype, 'scrollIntoView', {
  writable: true,
  value: () => {},
})

Object.defineProperties(Element.prototype, {
  hasPointerCapture: {
    writable: true,
    value: () => false,
  },
  setPointerCapture: {
    writable: true,
    value: () => {},
  },
  releasePointerCapture: {
    writable: true,
    value: () => {},
  },
})

beforeEach(async () => {
  localStorage.clear()
  await i18n.changeLanguage('en-US')
})
