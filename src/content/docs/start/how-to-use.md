---
title: How to use this site
description: How topic pages are laid out, how to search, and how to read the numbers.
---

## Two ways in

- **Learning a topic?** Start at the top of a page and read down. Every topic is written in the same order, so once
  you have read one you know where everything is in the rest.
- **Need a number or a tool?** Press <kbd>/</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd> to search, or jump straight to the
  calculator from the page's table of contents.

## Finding your way

- **The mission rail** (left; the ☰ menu on a phone) lists every one of the 64 zones in workflow order, grouped into
  eight phases, each with its own colour. Bright entries are rebuilt v2 pages. Entries tagged **v1** open the original
  reference directly at that zone, so nothing is ever missing.
- **The orbit map** at the top of the rail shows the eight phases as planets, with the zone you are on in the sun.
  Select a planet to jump to that phase in the list.
- **The zone banner** at the top of each page tells you where you are — *PHASE 3 OF 8 · SIZE · STEP 5 OF 10 · Z25* —
  with a dot for every zone in the phase (filled = v2, dashed = v1) and **PREV / NEXT** through the rebuilt pages. The
  same route continues at the foot of every page.
- **Zone numbers** match REF·DB v1 exactly, so a number on an old note still points at the same topic. Primer pages
  such as *How a solid motor works* are marked **P** and don't take a number.
- **MODE** switches between the dark mission view (default) and a light drawing-office view. **PAUSE MOTION** stops the
  background and every animation; it remembers your choice, and your system's reduced-motion setting is always obeyed.

## How every topic page is laid out

1. **At a glance** — the idea in one line and what to read first.
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
- **Factors are yours to enter.** Safety, proof, burst and life factors come from your programme's governing
  requirement, so the calculators start with them blank and show everything that doesn't need them. **Load worked
  example** fills in the page's example — including its factors, which are there only to reproduce the hand
  calculation.
- **Material data** is typical or minimum published data for early design, shared with REF·DB v1. Fracture toughness
  ($K_{IC}$) varies strongly with heat treatment, orientation, thickness and temperature, and is always flagged as
  indicative.

:::caution[Screening values, not design allowables]
Everything here is for learning and early sizing. Before anything is built, verify against the current issue of the
governing standard, your organisation's design rules, and approved allowables, and get the analysis signed off by the
responsible authority.
:::
