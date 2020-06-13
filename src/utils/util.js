'use strict';

const valueFromView = (view, num, pos) => {
    switch (num) {
        case 8:
            return view.getUint8(pos);
        case 16:
            return view.getUint16(pos, true);
        case 32:
            return view.getUint32(pos, true);
    }
}

const calXor = view => {
    let xor = 0;
    for (let p = 1; p < view.byteLength - 2; p++) {
        xor ^= valueFromView(view, 8, p);
    }
    return xor;
}

const verifyArrayBuffer = ab => {

    const view = new DataView(ab);
    const length = ab.byteLength;

    // 检查帧头和帧尾
    if (valueFromView(view, 8, 0) === 0xAA && valueFromView(view, 8, length - 1) === 0x55) {
        // 检查字节数相符合
        if (valueFromView(view, 8, 1) === length) {
            // 检查异或值
            if (valueFromView(view, 8, length - 2) === calXor(view)) {
                return {
                    valid: true,
                    view
                }
            }
        }
    }

    return {
        valid: false
    }
}

const processBle2Wifi = (arraybuffer) => {

    const { valid, view } = verifyArrayBuffer(arraybuffer);

    if (valid) {
        const length = view.byteLength;
        const type = valueFromView(view, 8, 2);
        const ts = valueFromView(view, 32, 3) * 1000;
        const te = valueFromView(view, 16, 7) / 10.0;
        const ti = valueFromView(view, 16, 9) / 10.0;
        const ta = valueFromView(view, 16, 11) / 10.0;
        const power = valueFromView(view, 8, 13);
        const devieAddrs = [];
        for (let p = 0; p < 6; p++) {
            devieAddrs.push(valueFromView(view, 8, 14 + p).toString(16));
        }
        const id = devieAddrs.join(':');
        const names = [];
        for (let p = 20; p < length - 2; p++) {
            names.push(String.fromCharCode(valueFromView(view, 8, p)));
        }
        const deviceName = names.join('');
        return {
            n: deviceName,
            i: id,
            ts,
            ti,
            te,
            ta,
        }
    }

}

module.exports = {
    processBle2Wifi,
}