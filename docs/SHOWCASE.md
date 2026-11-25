# The PROS showcase

The repository opens with the real Today screen and the fastest way to try PROS. The story that follows makes the progression concrete: practice adds time to a region, and a finished result can open the next room when both requirements are met.

## What informed the design

- GitHub recommends explaining why a project is useful and how to start. Use its native headings, links, alt text, and disclosures so the README works in a screen reader or at phone width. [GitHub README guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes) · [Collapsed sections](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-collapsed-sections)
- Excalidraw makes trying its product easy, and Immich gives its demo and documentation clear destinations. PROS pairs a sample world with an install link and puts the full build directions under a disclosure. [Excalidraw](https://github.com/excalidraw/excalidraw) · [Immich](https://github.com/immich-app/immich)
- Readers in open-source and GitHub discussions valued a visible screenshot and an obvious starting action. Their comments are qualitative input. The README leads with one real screen and offers further images, the lore excerpt, and the illustrated animation on request. [Open-source discussion](https://www.reddit.com/r/opensource/comments/19ek3pf/) · [GitHub discussion](https://www.reddit.com/r/github/comments/1uoulp2/the_first_60_seconds_on_a_github_repository/)
- The live showcase uses a native checkbox for each step in the restoration. Its requirements stay available as text, changed results are announced, and reduced motion removes the light transition. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## The artwork and screens

| Piece | Source |
| --- | --- |
| [The crossing to the Riverside Atelier](../public/showcase/atelier-crossing.jpg) | New editorial illustration for PROS, made with the built-in image generation tool using the Home painting as a palette reference. Optimized to 1440 × 576 for the repository and About page. |
| [Desktop Today](assets/field-guide/today-sample.jpg), [phone Today](../public/showcase/today.jpg), and [World](assets/field-guide/world-atelier.jpg) | Captured from real PROS screens using fresh sample profiles. |
| [The Canine Council](assets/field-guide/canine-council.webp) | Original storybook portrait guided by Olive’s app illustration and the project’s character descriptions. |
| [Atelier animation](assets/field-guide/atelier-first-light.gif) and [still](assets/field-guide/atelier-still.webp) | The earlier illustrated example of the first restoration. The animation plays once. [Drawing script](assets/field-guide/render-atelier.py) |

The About page’s restoration is an example with two reversible choices. It begins at 35 minutes and opens the room at 60 minutes with one finished result. Its image uses the existing Atelier painting. The main README’s real World screen shows the sample world’s own progress. [Playable example](https://pros-rpg.web.app/about.html#atelier)

<details>
<summary>Illustration prompt</summary>

Create a wide editorial painting for the open-source personal RPG PROS. The supplied Home painting is a reference for palette and craft. At blue hour, a low stone footbridge leads across a still river to the reopened Riverside Atelier. Its amber windows reveal a plain wooden workbench and a guitar on a stand. A small, entirely white Indian Spitz pauses on the near bank. Water, slate, and river weeds give the scene foreground depth. Distant observatory lights dot a gentle hill rather than dominating the composition. Make it feel like the end of an ordinary evening that mattered. Hand-painted, finely observed natural textures, blue slate and warm copper light, calm rather than epic. Frame the dog, bridge and workshop within the middle horizontal band for a 2.5:1 banner crop. No lettering, watermarks, interface, borders, or logos.

</details>

## Refresh the captures

Install the root dependencies and have Google Chrome available. Run this from the repository root.

```sh
node docs/assets/field-guide/capture-sample.mjs
```

The capture script starts a temporary local server and uses isolated sample profiles. The phone image is also copied into `public/showcase/` for the About page. The large showcase JPEGs load when requested. The production offline cache keeps the same app artwork and excludes them.

Check About and Support alongside the GitHub-rendered README before publishing a showcase revision. [Build and host PROS](DEPLOYMENT.md)
