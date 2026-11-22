# Possession lab

Replay NBA half-court possessions from 2025-26 player tracking with a second-by-second expected-points (EPV) line, and search for the most similar moments across the league.

- **Replayer**: 5 Hz positions for all ten players and the ball, trails, ball-handler ring, EPV curve with the biggest pass swings labelled. Space to play/pause, arrow keys to step. Links are shareable (`#p=<id>&t=<frame>`).
- **Play search**: for any moment, the 8 closest 2-second windows from other possessions — shortlisted with a pre-trained movement model's embedding, ranked by role-matched path distance in feet (mirror images included).
- **EPV**: transformer over the last 2 s of movement, fine-tuned from a masked-reconstruction movement model, trained on possession points with shot make/miss luck replaced by expected value; every possession is scored by a model that never saw its game.

Data is built by `poss_lab.py` in the court-model repo into `public/data/`. Stack: React, Vite, Arc (uiarc.dev) components, d3.
