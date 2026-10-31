# SurfVT14 Game Builds

Snapshot of the playable game builds and their runtime assets used by SurfVT14.

## Contents

- `public/maps/`: Subway Surfers map builds, Unity loaders, manifests, and per-map scripts.
- `public/maps/subwaycrackers/`: Subway Crackers Unity build.
- `public/moggers/index.html`: Subway Moggers Lite.
- `public/moggers/ultimate.html`: Subway Moggers Ultimate.
- `public/moggers/IMAGEMOG.png`: Moggers artwork used by SurfVT14.
- `public/chronometers/input-bridge.js`: shared input bridge referenced by Moggers Ultimate.
- `public/chronometers/save-bootstrap.js` and `public/downloads/subwaycrackers-p14-save.bin`: SurfVT14 save bootstrap and save backup.

No training builds are included.

## Map folders

The map folders currently included are Bangkok, Barcelona, Beijing, Berlin, Buenos Aires, Cairo, Havana, Hong Kong, Houston, Iceland, London, Mexico, Miami, Monaco, Moscow, New Orleans, New York, Paris, Rio, Saint Petersburg, San Francisco, Tokyo, Venice (modded), Venice Normal, Winter Holiday, and Zurich, plus Subway Crackers.

Each Subway Surfers map folder preserves the original site layout, including its `index.html`, Unity build files, and available `unlock-all.js` and `infinite-save.js` scripts. The scripts are kept alongside their respective map builds.

## Using the assets

The paths mirror the SurfVT14 `public/` directory. Copy the contents of `public/` to the document root of a static web server to preserve paths such as `/maps/...` and `/chronometers/...`. Moggers Lite also loads Three.js, Tailwind CSS, and fonts from public CDNs. Moggers Ultimate references the shared SurfVT14 input bridge.

Source site: https://github.com/vtcaua2014-dev/surfvt
