---
title: How to use this site
description: How topic pages are arranged, how to search, and how to read the numbers.
---

## Two ways in

- **Do you want to learn a topic?** Start at the top of a page and read down. All topics are written in the same
  sequence. When you have read one page, you know where to find all the items on the other pages.
- **Do you need a number or a tool?** Push <kbd>/</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd> to search, or go directly to
  the calculator from the table of contents of the page.

## Finding your way

- **The mission rail** (on the left; the ☰ menu on a phone) shows all 64 zones in workflow sequence, in eight phases.
  Each phase has its own colour. Bright entries are rebuilt v2 pages. Entries with the tag **v1** open the original
  reference at that zone, so no content is missing.
- **The orbit map** at the top of the rail shows the eight phases as planets, with your current zone in the sun. Select
  a planet to go to that phase in the list.
- **The zone banner** at the top of each page shows your location, for example *PHASE 3 OF 8 · SIZE · STEP 5 OF 10 ·
  Z25*. It has a dot for each zone in the phase (filled = v2, dashed = v1), and **PREV / NEXT** links through the
  rebuilt pages. The same links are also at the bottom of each page.
- **Zone numbers** are the same as in REF·DB v1. Thus a number on an old note still refers to the same topic. Primer
  pages such as *How a solid motor works* have the mark **P** and no number.
- **MODE** changes between the dark mission view (the default) and a light drawing-office view. **PAUSE MOTION** stops
  the background and all animations. The site remembers your selection, and it always obeys the reduced-motion setting
  of your system.

## How every topic page is laid out

1. **At a glance:** the idea in one line, and what to read first.
2. **Why it matters:** what goes wrong on real hardware if this is incorrect.
3. **Intuition:** an analogy from daily life (the blue *Think of it like…* boxes) and a diagram.
4. **The physics:** the equations, each one explained in words.
5. **The tool:** an interactive calculator that uses the same equations. *Copy link* shares your exact inputs.
6. **Worked example:** the result of the tool calculated by hand, step by step, so that you can check the two.
7. **Where this stops:** the limits of the method, and the errors that experienced engineers look for.
8. **On the drawing:** how to specify and verify the result.
9. **References:** open literature and the standards that control the real design.

## Reading the numbers

- **Units.** SI on all pages: MPa, mm, kg, °C. Some pages also show pressures in bar or psi.
- **Margin of safety.** $MS = \dfrac{\text{allowable}}{\text{applied}} - 1$. Zero means exactly at the limit. A
  negative value means that it does not meet the requirement.
- **You enter the factors.** Safety, proof, burst and life factors come from the requirements of your programme. Thus
  the calculators start with these fields empty, and show all the results that do not need them. **Load worked
  example** enters the example of the page, with its factors. These factors are there only to give the same result as
  the hand calculation.
- **Material data** are typical or minimum published data for early design, the same as in REF·DB v1. Fracture
  toughness ($K_{IC}$) changes much with heat treatment, orientation, thickness and temperature. The site always shows
  it as indicative.

:::caution[Screening values, not design allowables]
All the content is for learning and early sizing. Before you build anything, verify against the current issue of the
applicable standard, the design rules of your organisation and approved allowables. The responsible authority must
approve the analysis.
:::
