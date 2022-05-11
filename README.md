[![Run tests](https://github.com/DirtyHairy/yagb/actions/workflows/run-tests.yaml/badge.svg)](https://github.com/DirtyHairy/yagb/actions/workflows/run-tests.yaml)

# YAGB - **Y**et **A**nother **G**ame**b**oy Emulator

YAGB is a gameboy emulator that runs in your browser. It started as a fun project
at a [company](https://mayflower.de) hackathon and evolved into a full-fledged
emulator in about one month. It is written in TypeScript, and you can either run the
[build on github.io](https://dirtyhairy.github.io/yagb) or build and run it from scratch.

# Usage

In its current form YAGB gives you a CLI-like interface that allows you to load, run
and debug ROM images. The most important commands are

* `load`: Load a ROM image (`.gb`)
* `run`: Run or resume the current ROM
* `stop`: Pause the current ROM
* `reset`: Reset the current ROM
* `help`: Show available commands and keybindings

The emulator is controlled with the following key bindings:

* **Enter**: Start
* **Space**: Select
* **a/y/z**: B
* **s/x**: A
* **Arrow Keys**: Joypad
* **Shift-Enter**: Pause / Resume
* **Shift-Space**: Reset
* **+/-**: Volume up / down
* **Page up / down**: Change emulation speed

**IMPORTANT**: You need to click the canvas (screen image) to give it focus in order
for the key bindings to work!

The emulator stores the last ROM in local storage and loads it automatically on load.
Games with battery buffered RAM have their RAM persisted in local storage as well, so
you can load up save games and continue playing the next time you start the corresponding
ROM.

The interface is not yet suitable to run the emulator on mobile phones (as there
is no way to control it), but we plan to add a more full-fleged web app with touch support
eventually.

# Accuracy and performance

YAGB was designed to be suitable for usage on smartphones without excessive
battery drain, so it has been built with performance in mind. On my M1 Macbook Chrome
and Safari can run most games at about 20x their original speed, which amounts to about
1200 FPS. Firefox runs slower but still reaches between 5x and 10x native speed. My
iPhone 7 reaches about 4x native speed.

As a tradeoff for performance, YAGB does not try to be a fully cycle exact emulator.
Instead, its components try to batch and process as many cycles as possible in one
step, and the PPU is not emulating the pixel fetchers, but uses a simpler line-based
renderer instead. Within these constraints, the emulator tries to be as accurate as
possible.

Audio is not strictly cycle exact either, but instead synchronizes at a rate that
corresponds to the host sample rate. Almost all games sound fine (including those
that abuse the hardware to play PCM samples), but there is no sophisticated resampling,
so high pitched sounds may exhibit slight ringing due to aliasing artifacts.

That said, YAGB passes the CPU tests in the [Blargg suite](https://github.com/retrio/gb-test-roms),
displays [mattcurrie's ACID2 test](https://github.com/mattcurrie/dmg-acid2) correctly
and passes parts of the [Mooneye suite](https://github.com/Gekkio/mooneye-test-suite).
Almost all games that we tried run flawlessly, including notrious oddballs like
the Addams Family and Hook (not Road Rash though).

# Building and runnning

Simple. Make sure that you have [yarn](https://yarnpkg.com) installed, then do

```
    $ yarn install
```

to install the dependencies and

```
    $ yarn start
```

or

```
    $ yarn build
```

to start the development server (on port 9000) or do a release build. The build
will end up in `dist`.

# Resources

The following resources were used to create YAGB

* The [Pan Docs](https://gbdev.io/pandocs/)
* Marc Rawer's [Gameboy Hardware Manual](http://marc.rawer.de/Gameboy/Docs/GBCPUman.pdf)
* Pastraisers [opcode table](https://www.pastraiser.com/cpu/gameboy/gameboy_opcodes.html)
* The [gbdev wiki](https://gbdev.gg8.se/wiki/articles/Gameboy_sound_hardware) and
  nightshade256's excellent breakdown of the APU documentation
* Martin Korth's [notes](http://gameboy.mongenel.com/dmg/istat98.txt) on the stat interrupt
* Ocassional glances on the excellent [Sameboy source](https://github.com/LIJI32/SameBoy) for
  clarifying edge cases with conflicting or missing information
* Random flotsam and jetsam on Reddit and StackOverflow


# Credits

Parts of YAGB were developed during slacktime provided by the awesome folks at
[Mayflower GmbH](https://mayflower.de).
