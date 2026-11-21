# Playtesting the expansion

The preview builds on Connected Island at `3bc7b05`. The school, agriculture and roadway work from PR #3 was adapted to that game's parcel, economy and rendering systems. The rail and faith briefs now have playable implementations. The three original example islands still have separate saves.

## Five things to try

1. Open **Game menu → Example islands → Copper Gorge**. In the island guide, choose **The east campus and creamery**. Select the high school and open **Connections** to see the adjacent sports field's benefit. Select the dairy to inspect its module count, operating status and actual production. Remove a link, inspect the result, then undo the edit.
2. Choose **The sanctuary on the ridge**. The inspector shows active community services, beds and the blessing clock. In God mode, invoke **Bountiful harvest**, then compare food production with **Clear passage** active instead. Fire and invasions leave the temple standing. Residents can return to connected homes after a disaster.
3. Open **Switchyard City** and expand its island guide. Choose **Open Orchard Valley rail yard**. Select the depot and open **Rail Operations**. Try a timetable change in **Lines**, inspect the consist in **Cars** and follow a delivery in **Cargo**. The train's cars follow the track through the shared junction and across the steel bridge.
4. Select a busy road and open its site details. Upgrade the segment, then compare hourly demand, capacity and the markings on the road. New highways use two tiles of width and freeways three. Older cities preserve their existing alignments.
5. In **Island tools → Land & water**, choose **Bridge** and a rail or road deck. Drag from bank to bank, inspect the clearance and connect the approaches along the bridge. Select a crossing to upgrade the run as one structure. A short stone span and a long, upgraded stone crossing acquire different silhouettes.

## What the pictures show

The illustrated handbook includes the running school, creamery, farm crews, trains, mobile rail editor and temple shelter. The construction comparison plates use the game's geometry in isolated views, and the atlas uses each element's voxel builder. These are selected views of the same models used by the preview.

- [The east campus and creamery](../../public/handbook/scenes/east-campus.jpg)
- [A 60-module working farm](../../public/handbook/expansion/farm-crew.webp)
- [A passenger train on a steel bridge](../../public/handbook/scenes/rail-passenger-bridge.webp)
- [Rail Operations on a phone-sized screen](../../public/handbook/scenes/rail-operations-mobile.webp)
- [Five rail bridge constructions](../../public/handbook/scenes/railway-crossings.webp)
- [The temple after both homes were destroyed](../../public/handbook/scenes/sanctuary-recovery.jpg)

## Reproducing the checks

Run `npm run lint`, `npm test` and `npm run build`. Run `node scripts/build-preview.mjs ./portable` to generate the offline game, illustrated handbook, three world launchers and a standalone atlas.

The catalog checks build every supported level in all four styles. The district checks include complexes with 5, 10, 25, 50 and 110 modules. Recovery tests cover attacks, fire, old saves, blessing cooldowns, limited beds and rebuilding. Road and rail checks cover broken connections as well as journeys that complete. The example-city tests advance time and check actual service deliveries and city accounts.

An additional saved-city check on the development computer reconstructed all 910 sites and advanced twenty simulation seconds. Browser checks used desktop and phone-sized Chrome windows. Frame rate on physical phones will vary with the device and city.
