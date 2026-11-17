import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { REGIONS } from '../catalog';
import { RegionScene, regionSceneAsset, sceneStage } from './RegionScene';

describe('regional scene presentation boundaries',()=>{
  it('contains invalid or untrusted display stages without granting a later appearance',()=>{
    for(const value of [NaN,Infinity,-Infinity,-4])expect(sceneStage(value)).toBe(0);
    expect(sceneStage(2.9)).toBe(2);expect(sceneStage(10)).toBe(3);
    expect(regionSceneAsset('sanctuary',NaN)).toBe('/art/sanctuary-base.webp');
  });
  it('renders every regional tier with a stable canvas and adds earned landmarks only at the corresponding stage',()=>{
    const landmarks={observatory:['aligned-telescope','chart-room','living-sky-atlas'],foundry:['working-hearth','working-bench','central-mechanism'],training:['cleared-route','restored-pavilion','complete-circuit'],citadel:['open-gates','council-room','exchange-hall'],sanctuary:['reflection-seat','returning-garden']};
    for(const region of REGIONS){
      const views=[0,1,2,3].map(stage=>renderToStaticMarkup(createElement(RegionScene,{regionId:region.id,stage})));
      for(const html of views){expect(html).toContain('viewBox="0 0 1536 1024"');expect(html).not.toContain('data-landmark="kept-work"');}
      expect(new Set(views).size).toBe(4);
      if(region.id!=='atelier')for(const [index,name] of landmarks[region.id].entries()){
        for(let stage=0;stage<3;stage++)expect(views[stage].includes(`data-landmark="${name}"`)).toBe(stage>=index+1);
      }
    }
  });
  it('uses the restored Sanctuary and Atelier paintings only for a flourishing appearance',()=>{
    for(let stage=0;stage<3;stage++){
      expect(regionSceneAsset('sanctuary',stage)).toBe('/art/sanctuary-base.webp');
      expect(regionSceneAsset('atelier',stage)).toBe('/art/atelier.webp');
    }
    expect(regionSceneAsset('sanctuary',3)).toBe('/art/sanctuary.webp');
    expect(regionSceneAsset('atelier',3)).toBe('/art/atelier-flourish.webp');
  });
});
