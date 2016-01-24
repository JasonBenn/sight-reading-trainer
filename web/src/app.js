import 'normalize.css'
import './styles.scss'
import { floor, range, partial, each, filter, find, pluck, uniq } from 'lodash'
import $ from 'jquery'
import DrawMusic from './draw'
import SongReader, { MidiNote } from './song-reader'
import Piano from './piano'

class Trainer {
  constructor() {
    var canvas = document.getElementById("sheet-music")
    this.draw = new DrawMusic(canvas)
    this.errorTime = 0
    this.currentTime = 0
    this.incorrectNotes = {}
    this.incorrectNotesCount = 0
    this.correctNotesCount = 0

    $(document).click(() => this.errorTime -= 300)
  }

  connectToPiano() {
    return new Piano(this.onMidiMessage.bind(this))
  }

  load(url) {
    return $.get(url, this.onLoad.bind(this))
  }

  updateChord() {
    this.currentNotes = this.songReader.getNextChord()
  }

  onLoad(data) {
    this.songReader = new SongReader(data)
    this.updateChord()
  }

  renderTranslated(panX, panY = 0) {
    this.draw.clearAndPan(panX, panY)
    this.draw.staff()
    this.draw.notes(this.songReader.leftHand)
    this.draw.notes(this.songReader.rightHand)
    this.draw.divider(panX)
    this.draw.notes(_.values(this.incorrectNotes), panX - 500)
  }

  render(startTime) {
    this.currentTime = (Date.now() - startTime)
    const panX = -this.currentTime * 0.1 - this.errorTime
    this.renderTranslated(panX)
    requestAnimationFrame(partial(this.render.bind(this), startTime))
  }

  onMidiMessage(msg, correctCb, incorrectCb) {
    const [eventType, noteNumber, velocity] = msg.data
    const correctNotePlayed = _.find(this.currentNotes, note => note.noteNumber === noteNumber)

    if (correctNotePlayed) {
      if (velocity) {
        this.correctNotesCount += 1
        correctNotePlayed.playedCorrectly = true
      } else {
        this.correctNotesCount = Math.max(this.correctNotesCount - 1, 0)
        correctNotePlayed.playedCorrectly = null
      }
    } else {
      if (velocity) {
        this.incorrectNotes[noteNumber] = new MidiNote({ noteNumber, playedCorrectly: false, deltaTime: 0, subtype: 'noteOn' })
        this.incorrectNotesCount += 1
      } else {
        delete this.incorrectNotes[noteNumber]
        this.incorrectNotesCount = Math.max(this.incorrectNotesCount - 1, 0)
      }
    }

    if (this.correctNotesCount === this.currentNotes.length && !this.incorrectNotesCount) {
      this.correctNotesCount = 0
      this.incorrectNotesCount = 0
      this.updateChord()
    }
  }
}

const trainer = new Trainer()
trainer.connectToPiano()
  .then(() => trainer.load('api/claire'))
  .then(() => trainer.render(Date.now()))
