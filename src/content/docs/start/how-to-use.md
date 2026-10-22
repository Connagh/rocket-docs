---
title: How to use this site
description: How topic pages are laid out, how to search, and how to read the numbers.
---

## Two ways in

- **Learning a topic?** Start at the top of a page and read down. Every topic is written in the same order, so once
  you have read one you know where everything is in the rest.
- **Need a number or a tool?** Press <kbd>/</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd> to search, or jump straight to the
  calculator from the page's table of contents.

## How every topic page is laid out

1. **At a glance** — the idea in one line, what to read first, and the legacy zone it replaces.
2. **Why it matters** — what goes wrong on real hardware if you get this wrong.
3. **Intuition** — an everyday analogy (the blue *Think of it like…* boxes) and a diagram.
4. **The physics** — the equations, each one explained in words.
5. **The tool** — an interactive calculator built on the same equations. *Copy link* shares your exact inputs.
6. **Worked example** — the tool's answer done by hand, step by step, so you can check both.
7. **Where this stops** — the limits of the method and the traps experienced engineers watch for.
8. **On the drawing** — how the result is specified and verified.
9. **References** — open literature and the standards that govern the real design.

## Reading the numbers

- **Units.** SI throughout: MPa, mm, kg, °C. Pressures can be shown in bar or psi where it helps.
- **Margin of safety.** $MS = \dfrac{\text{allowable}}{\text{applied}} - 1$. Zero means exactly at the limit;
  negative means it fails the requirement.
- **Material data** is typical or minimum published data for early design, shared with REF·DB v1. Fracture toughness
  ($K_{IC}$) varies strongly with heat treatment, orientation, thickness and temperature, and is always flagged as
  indicative.

:::caution[Screening values, not design allowables]
Everything here is for learning and early sizing. Before anything is built, verify against the current issue of the
governing standard, your organisation's design rules, and approved allowables, and get the analysis signed off by the
responsible authority.
:::
