import { CHRISTMAS_ELEMENTS } from "../christmasCatalog";
import type { Ctx } from "./kit";
import { defineDesigns } from "./registry";
import { christmasTree, snowman, sleigh, santaHouse, elfCottages, workshop, stable, grotto } from "./christmasVillage";
import { bakery, candyWorks, market, postOffice, iceRink, nutcracker, choir, giftHall, nativity, globe, carousel, bellTower } from "./christmasFair";

const builders: Record<string, (c:Ctx)=>void> = {
  christmas_tree:christmasTree, christmas_snowman:snowman, santas_sleigh:sleigh, santas_house:santaHouse,
  elf_cottages:elfCottages, santas_workshop:workshop, reindeer_stable:stable, gingerbread_bakery:bakery,
  candy_cane_works:candyWorks, christmas_market:market, north_pole_post:postOffice, christmas_ice_rink:iceRink,
  nutcracker_guard:nutcracker, carolers_bandstand:choir, black_santa_grotto:grotto, gift_wrap_hall:giftHall,
  nativity_stable:nativity, christmas_snow_globe:globe, christmas_carousel:carousel, christmas_bell_tower:bellTower,
};
defineDesigns(Object.fromEntries(CHRISTMAS_ELEMENTS.map(def=>[def.id,{
  footprints:def.footprints,levels:def.levelNames,growth:def.growth,build:builders[def.id],
}])));
