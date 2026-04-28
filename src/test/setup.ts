import '@testing-library/jest-dom'

// jsdom 环境缺少 DOMMatrix，pdfjs-dist canvas.js 模块加载时需要
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
    m11 = 1; m12 = 0; m13 = 0; m14 = 0
    m21 = 0; m22 = 1; m23 = 0; m24 = 0
    m31 = 0; m32 = 0; m33 = 1; m34 = 0
    m41 = 0; m42 = 0; m43 = 0; m44 = 1
    is2D = true; isIdentity = true
    constructor(_init?: string | number[]) {}
    static fromMatrix() { return new DOMMatrix() }
    static fromFloat32Array() { return new DOMMatrix() }
    static fromFloat64Array() { return new DOMMatrix() }
    multiply() { return new DOMMatrix() }
    translate() { return new DOMMatrix() }
    scale() { return new DOMMatrix() }
    rotate() { return new DOMMatrix() }
    rotateFromVector() { return new DOMMatrix() }
    rotateAxisAngle() { return new DOMMatrix() }
    skewX() { return new DOMMatrix() }
    skewY() { return new DOMMatrix() }
    flipX() { return new DOMMatrix() }
    flipY() { return new DOMMatrix() }
    inverse() { return new DOMMatrix() }
    transformPoint() { return new DOMPoint() }
    toFloat32Array() { return new Float32Array(16) }
    toFloat64Array() { return new Float64Array(16) }
    toJSON() { return {} }
    toString() { return 'matrix(1, 0, 0, 1, 0, 0)' }
    invertSelf() { return this }
    multiplySelf() { return this }
    preMultiplySelf() { return this }
    translateSelf() { return this }
    scaleSelf() { return this }
    scale3dSelf() { return this }
    rotateSelf() { return this }
    rotateFromVectorSelf() { return this }
    rotateAxisAngleSelf() { return this }
    skewXSelf() { return this }
    skewYSelf() { return this }
    setMatrixValue() { return this }
    scale3d() { return new DOMMatrix() }
  } as unknown as typeof DOMMatrix
}
