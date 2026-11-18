# The PROS field guide

A plan for the repository's front page. The visual idea is a field guide left open on the Surveyor's desk. A visitor should see a world worth exploring, understand what changes it, and know how to try it.

## 1. Open the book

Give **PROS · Personal RPG Operating System** a quiet title treatment and one panoramic illustration from the world. Start with a concrete example from the Atelier. A guitar session and a recording give readers something to imagine before they encounter features or setup. Keep the first local-run link near the title.

## 2. Show the transformation

Use a short illustrated animation to tell one true story about the mechanics. With 35 minutes already recorded, 25 more guitar minutes bring the Atelier to its first time threshold. Saving one finished result opens its first restoration stage. Show both requirements as the room comes to life. Keep the explanation beside the media so it also works as text.

Capture the real sample world from the repository build for a separate screen image. The illustration introduces the world. The screen image shows what someone will actually open.

## 3. Give the atlas room

Let the six regions read like places with distinct crafts, from the Foundry's working bench to the Sanctuary's quiet pavilion. A short expansion can hold the longer tour. Reserve the default page for the main experience, the world, and the way in.

## 4. Print the colophon

Place Revaan Mishra's name in a maker's note at the end of the feature, beside the personal details that give the project its character. Give Freddie, Olive, Coco, and Mungru a single illustrated council portrait. Use their established storybook appearances, name each dog in readable text, and give Freddie a gentle memorial detail. Olive's role as the in-app companion gets one clear line.

## 5. Close with a working door

Keep the tested build commands and link to the technical guides. Label the current GitHub build accurately. Check the rendered Markdown, image alternatives, motion file size, links, and GitHub verification run.

## References for the treatment

- The open-source README discussion points to a strong first impression and an easy way to see the actual product. [Community README discussion](https://www.reddit.com/r/opensource/comments/1kk1wd8/)
- Paddock's maintainers document a repeatable presentation of real application screens and a compact README animation. [Paddock demo production notes](https://github.com/edspencer/paddock/blob/main/scripts/demo-gif/README.md)
- GitHub's animated image controls and supported expandable sections make it possible to use native presentation features. [Motion settings](https://docs.github.com/en/account-and-profile/how-tos/account-settings/managing-accessibility-settings#managing-motion) · [Expandable sections](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-collapsed-sections)


## What went into the page

| Media | Source |
| --- | --- |
| [Surveyor’s atlas](assets/field-guide/surveyors-atlas.webp) | Original cover made with the built-in ImageGen tool using the app’s Home painting as a style reference. |
| [The Canine Council](assets/field-guide/canine-council.webp) | Original storybook portrait made with the built-in ImageGen tool. Olive’s in-app illustration and the project’s established character descriptions guided the four dogs. |
| [The Atelier turns on its lights](assets/field-guide/atelier-first-light.gif) | Drawn in Pillow from the app’s first region threshold. The animation plays once and ends on the completed room. [Still](assets/field-guide/atelier-still.webp) · [Source](assets/field-guide/render-atelier.py) |
| [Today in the sample world](assets/field-guide/today-sample.jpg) | Actual interface captured from the repository with headless Chrome in a new sample profile. [Capture script](assets/field-guide/capture-sample.mjs) |

Run `python3 docs/assets/field-guide/render-atelier.py` with Pillow to redraw the illustrated example. From the repository root after installing dependencies, run `node docs/assets/field-guide/capture-sample.mjs` with Chrome installed to capture Today. The capture uses a temporary loopback server and blocks external requests.

<details>
<summary>Illustration briefs</summary>

**Surveyor’s atlas**

Use case: illustration-story. Make a new wide landscape cover illustration for the PROS Personal RPG Operating System repository, a hand-painted plate from the Surveyor's field guide. The provided artwork is a style and world reference only. In a shallow overhead angle, a beautiful open cloth-bound atlas on a quiet dark walnut worktable, its folded paper chart nearly fills the panorama. The chart depicts an imaginative but believable river valley in fine ink hatching and muted watercolor: six recognizable landmarks distributed along pale meanders (domed observatory, working foundry, a riverside atelier, simple training pavilion, walled citadel, a wooded sanctuary). Show the river, contour lines and landmarks as parts of one old hand-painted chart, with slight dimensional papercraft folds, never as a set of panels or digital interface. A plain brass compass and one used dark teal guitar pick sit beside the fold, each small and natural, to connect the atlas to real practice. Night blue, desaturated pine, warm ivory fibers, soft amber from an offscreen desk lamp, hand-inked detail with negative space and pleasing restraint. The atlas fills the center and reaches toward both edges. Choose a panoramic landscape layout suitable for a GitHub hero, about 2.3:1 if supported. Leave safe margins on top and bottom. The image must read clearly as a small thumbnail in light and dark surroundings. No text, letters, numbers, logos, watermark, interface, avoid elaborate fantasy gloss. Finish like an illustrated endpaper in a well-loved adventure book.

**The Canine Council**

Use case: illustration-story. Original wide hand-painted companions' portrait for PROS, the Canine Council. Provided image is a visual reference for Olive only. Paint EXACTLY FOUR clearly distinct small cute storybook dogs, all sitting side by side at roughly equal visual weight on a long moss-green cushion under a low wooden sill with a quiet dark teal alcove. Wide landscape image, four bodies and noses unobstructed, use full width with comfortable safe margin. Exact left-to-right order: Freddie (adult gentle sleek BLACK Labrador, warm brown eyes, floppy ears, small warm gold collar tag; one tiny quiet star embroidered just above his spot as a memorial detail), Olive (small completely pure WHITE fluffy Spitz matching reference, pointed ears and curled tail, dark teal collar and small round brass tag; her coat is white, no cream or beige), Coco (small curious honey-gold dog, perky ears and little friendly smile, warm ochre collar), Mungru (black-and-beige Indian street dog, dark saddle and tan eyebrows and muzzle, upright ears, a relaxed steady gaze, muted blue collar). These are affectionate stylized portraits based on established character references, not photos. Express individuality through posture and face, cute like a printed children's book but with convincing canine anatomy and restrained adult art direction. Fine gouache brush grain and ink edges, antique page or wood frame warmth, welcoming lamplight, minimal background so silhouettes stay readable at mobile size. No humans, extra animals, text, nameplates, labels, decorative halos, logo, watermark, busy scenery, airbrushed plastic finish. Approximately 2.5:1 panoramic composition if supported.

</details>
