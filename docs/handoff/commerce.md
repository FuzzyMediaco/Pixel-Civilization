# Commerce designs: handoff

File: `src/game/designs/commerce.ts`. Every id below is registered and typechecks. All of them have been checked in the gallery at 5 levels x 4 variants, plus one night pass.

| id | status | footprints L1→L5 | levels | variants |
|---|---|---|---|---|
| shops | done | 1x1,2x1,2x2,3x2,3x3 | Corner Boutique / Strip of Shops / Market Street / Glass-Roofed Arcade / Grand Department Store | Main St / Parisian / Dutch canal / Tokyo neon |
| grocery_store | done | 1x1,2x1,2x2,3x2,3x3 | Produce Stand / Corner Grocer / Neighborhood Supermarket / Hypermarket & Loading Docks / Rooftop-Farm Megamarket | Farmers' (apple) / Retro 60s (orange) / Organic co-op (melon slice) / Asian market (grapes) |
| businesses | done | 1x1,1x1,2x1,2x2,3x2 | Garage Startup / Main-Street Office / Co-Working Loft / Office Park / HQ Campus | Brick warehouse / Scandi timber / Silicon glass / SW adobe |
| buildings | done | 1x1,1x1,1x1,2x2,2x2 | Walk-Up Block / Mid-Rise / Glass High-Rise / Skyscraper / Supertall Crown Tower | Art Deco / Modern glass / Brutalist / Postmodern |
| restaurants | done | 1x1,1x1,2x1,2x2,2x2 | Street Food Cart / Corner Diner / Bistro with Patio / Three-Floor Dining House / Revolving Skyline Restaurant (rotor) | 50s diner / Parisian bistro / Izakaya / Taco plaza |
| cheesesteak_restaurants | done | 1x1,1x1,2x1,2x2,2x2 | Grill Cart / Walk-Up Window / Corner Joint / Rival Neon Corner / Cheesesteak Palace (spinning hoagie) | Philly neon / Brick rowhouse / Stadium tailgate (scoreboard) / Food-truck yard |
| bars | done | 1x1,1x1,2x1,2x2,2x2 | Corner Tap / Pub / Tavern & Beer Garden / Nightclub with Rooftop Lounge / Sky-Bar Tower (searchlight rotors) | Irish pub / Tiki / Neon cocktail / Bavarian beer hall |
| clothing_stores | done | 1x1,1x1,2x1,2x2,2x2 | Pop-Up Boutique / Two-Floor Boutique / Fashion House / Flagship & Runway / Fashion Tower (spinning hanger) | Paris couture / Streetwear / Boho / Luxury minimal |
| thrift_stores | done | 1x1,1x1,2x1,2x2,3x2 | Garage Sale / Thrift Shop / Vintage Emporium / Flea-Market Warehouse / Mega Flea Bazaar | 70s retro (vinyl) / Red barn (teapot) / Victorian (gramophone) / Container upcycle (recycle) |
| shoe_stores | done | 1x1,1x1,2x1,2x2,2x2 | Cobbler's Kiosk / Shoe Shop / Sneaker Store / Shoe Flagship / The Giant Shoe House | Sneaker / Cowboy boot / Stiletto / Dutch clog |
| gas_stations | done | 1x1,2x1,2x2,3x2,3x2 | Roadside Pump / Canopy Station / Service Station & Garage / Truck Stop & Car Wash (brush rotors) / Solar EV Superhub (turbine) | Route 66 / Corporate / Art Deco / Space-age saucer |
| atms | done | 1x1 all | Wall-Slot / Kiosk / Drive-Thru / 24h Glass Lobby / Golden Cash Tower (spinning coin) | Green / Crimson / Crypto neon / Gold |
| banks | done | 1x1,2x1,2x2,2x2,2x2 | Teller Office / Columned Savings Bank / Domed Vault Bank / Bank Tower / Financial HQ (ticker + bull) | Neoclassical / Victorian brick / Modern glass / Art Deco |
| malls | done | 2x2,3x2,3x3,4x3,4x4 | Strip Mall / Skylit Enclosed Mall / Regional Mall & Food-Court Dome / Megamall with Cinema / Mega-Resort Mall (Ferris wheel) | 80s pastel / Glass galleria / Desert luxury / Asian LED megamall |
| data_centers | done | 2x2,2x2,3x2,3x3,4x4 | Server Hut / Colocation Hall / Twin Data Halls / Server Campus / Hyperscale AI Campus (dish rotor) | Corporate / Arctic / Desert solar / Earth-berm bunker |

## Known issues and next steps
- The gas station L5 EV hub looks almost the same in V0, V1 and V2: only the colours and canopy wave change.
- The mall L1 strip mall is plain. At L4 the cinema and parking garage sit at the back, so they are mostly hidden from the default camera.
- The bars L5 tower and the restaurants L4 V1 and V3 could use more detail.
- The Dutch clog Shoe House (shoe_stores L5 V3) is low and squat.
- Data-center halls are plain boxes.
- The bank Art Deco variant (V3) is close in style to buildings V0. They have different palettes (black and gold vs tan) but similar setbacks.
- Searchlight beams (bars) are rotors. They extend beyond the footprint, because rotors are not clipped.

## Gallery commands
```
./scripts/gallery-server.sh
node scripts/shoot-gallery.mjs "cat=commerce&ids=shops&mode=full&cell=300" out.png
node scripts/shoot-gallery.mjs "cat=commerce&mode=levels&variant=0&night=1&cell=200" night.png
```
If you get "Execution context destroyed", Vite HMR reloaded the page because another file was edited. Rerun the command.
