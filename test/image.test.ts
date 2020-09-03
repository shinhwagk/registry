import { ProxyLayer } from '../src/image/layer'
import { sha256sum, sleep } from '../src/helper'
import { mkdirpSync, removeSync } from 'fs-extra'
import { storageDir } from '../src/constants'

const sha256 = '70a4a9f9d194035612c9bcad53b10e24875091230d7ff5f172b425a89f659b95'
const owner = 'openshift'
const image = 'okd-content'

beforeAll(() => {
    mkdirpSync(storageDir)
})

afterAll(async () => {
    await sleep(5000)
    removeSync(storageDir)
})

describe('test image', () => {
    const pil = ProxyLayer.create(owner, image, sha256)
    test('Check image', async () => {
        await pil.verify()
        console.log('verify')
        const blobsShasum = await sha256sum(`${storageDir}/quay.io/openshift/okd-content/${sha256}/blobs`)
        expect(blobsShasum).toBe(sha256)
    }, 60 * 1000);
})