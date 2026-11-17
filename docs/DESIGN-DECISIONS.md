# Design decisions

PROS turns recorded effort into a world that develops through meaningful work. Its daily experience should help someone begin an activity, recognize progress, and find their next step.

The design draws selectively on Nir Eyal’s Hook Model and BJ Fogg’s Behavior Model. These are design lenses. Their inclusion does not establish that PROS improves retention, forms a habit, or changes a person’s real-world behavior. Those outcomes need observation with actual users.

## A useful daily loop

The intended loop is:

**A useful cue → one clear next action → real practice → quick recording → visible earned progress → a clearer next session.**

Today shows a small selection of next steps, due routines, equipped skills, and the current adventure. Quests express concrete actions. A focus session provides a defined space to work. Recording that work updates the same underlying evidence used by the skill, character, project, history, and world screens.

The goal is to support the activity the user chose. App openings and time spent browsing menus do not earn effort XP.

## Selective use of the Hook Model

Eyal describes four phases: trigger, action, variable reward, and investment. He describes investment as something that can make future use more valuable. [Original explanation of the Hook Model](https://www.nirandfar.com/how-to-manufacture-desire/)

The following are PROS’s application decisions:

| Phase | Current feature | Design choice |
| --- | --- | --- |
| Trigger | Today’s next steps, due routines, and current adventure | Present a relevant action when the user visits. Launch reminders stay inside the app. |
| Action | Recent-skill default, quick effort estimates, linked quest logging, and persisted focus sessions | Reduce repeated setup and keep recording useful work straightforward. |
| Reward | Skill progress, earned world stages, chapter scenes, and eligible wardrobe items | Explain what the effort accomplished. Variety comes from the world’s regions, artwork, and stories. |
| Investment | Custom quests, projects, skills, avatar choices, journal, library, and activity history | Accumulated records and choices make the next session more personally useful. Full backup export remains available. |

PROS does not implement randomized XP, paid loot boxes, or an escalating attendance reward. An hour of equivalent valid effort receives the same credit at every level. World changes and cosmetics require explicit effort and output conditions.

Story scenes are opened deliberately. Restored regions have distinct visual stages. Rewards do not require a separate repeated “claim” action. These choices allow expression and discovery while keeping progression understandable.

## Making the action easier

Fogg’s model brings together motivation, ability, and a prompt. The Stanford explanation also describes motivation and ability as compensatory: making an action easier can reduce the motivation needed. [Stanford Behavior Design Lab](https://behaviordesign.stanford.edu/resources/fogg-behavior-model)

PROS applies this through a few selected starting skills, guided starter projects, small preparation steps, a shared activity sheet, quick duration choices, and recoverable drafts. Users can edit a project to make the next action more realistic. The usefulness and tap count of those flows still require hands-on testing.

## Predictable evidence, expressive rewards

One credited minute earns one effort XP. Allocations share that effort across skills, while character and attribute views express the same record. A checkbox, page-count edit, or repeated save does not mint a second effort award.

Regions require both relevant effort and distinct outputs. A project’s guardian reflects preparation, relevant practice, and delivery. The wardrobe uses deterministic eligibility. The artwork and optional ambient soundtrack contribute atmosphere without affecting reward rates or timer correctness.

Numeric progress and unlocks recalculate after a factual correction. If the supporting evidence no longer meets a requirement, a region can return to an earlier stage and its cosmetic becomes unavailable. Undo restores the original evidence and reevaluates the result.

## A forgiving return

An absence never reduces cumulative effort, character levels, or eligible equipment. There is no health loss for missing a day. Recurring actions can be skipped or paused, and projects can rest without being treated as a personal failure.

This separates a correction to the record from time away from the app. It also supports schedules that do not follow a daily streak.

## What to validate

Observe whether someone can find a worthwhile next action, record it with little friction, understand the resulting progress, and return voluntarily. Ask whether the game supports their real activity and whether its world is meaningful after the initial novelty wears off.

Browser and physical-device validation remain documented in the [release checklist](RELEASE-CHECKLIST.md). Neither the cited frameworks nor an attractive interface substitute for that validation.
