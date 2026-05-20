# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin).

## Type Support For `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin) to make the TypeScript language service aware of `.vue` types.

If the standalone TypeScript plugin doesn't feel fast enough to you, Volar has also implemented a [Take Over Mode](https://github.com/johnsoncodehk/volar/discussions/471#discussioncomment-1361669) that is more performant. You can enable it by the following steps:

1. Disable the built-in TypeScript Extension
   1. Run `Extensions: Show Built-in Extensions` from VSCode's command palette
   2. Find `TypeScript and JavaScript Language Features`, right click and select `Disable (Workspace)`
2. Reload the VSCode window by running `Developer: Reload Window` from the command palette.

## ⚠️ Legal Disclaimer & Terms of Use

This project is an independent, open-source tool developed by the community. It is **not** affiliated with, endorsed by, sponsored by, or associated with **Konami Group Corporation**, **The Pokémon Company International (TPCi)**, **RK9 Labs**, **Carde.io**, **Legend Story Studios (LSS)**, or any of their respective partners. All trademarks, service marks, trade names, and copyrights are the property of their respective owners.

**1. Purpose of the Tool**
The "PurpleFox Companion" extension is designed strictly as a Quality of Life (QoL) utility for Tournament Organizers (TOs) and Judges. Its sole purpose is to automate the manual, tedious process of transcribing tournament data (such as pairings and standings) from official platforms into the PurpleFox software, reducing human error and saving time during live events. 

**2. User Responsibility and Terms of Service (ToS)**
Please be aware that using automated scripts or extensions to extract data from websites may violate the Terms of Service (ToS) or Acceptable Use Policies of certain platforms (including, but not limited to, the Konami Card Game Network and RK9.gg). 

This extension operates entirely client-side, simply reading data your account already has legitimate access to. However, **you use this tool entirely at your own risk.** The developer(s) of this repository assume zero responsibility or liability for any account bans, IP blocks, suspensions, or legal actions taken against you by the respective platform owners. 

**3. Data Privacy**
This extension does not harvest, store, or transmit your personal data or session cookies to any third-party servers. All extraction happens locally within your browser to facilitate clipboard copying.

By downloading and using this extension, you acknowledge and agree to these terms, taking full responsibility for your actions on third-party platforms.