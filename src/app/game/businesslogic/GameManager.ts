import { defaultData } from "../data/DefaultData";
import { CharacterEntity } from "../model/CharacterEntity";
import { CharacterData } from "../model/data/CharacterData";
import { Data } from "../model/data/Data";
import { EditionData } from "../model/data/EditionData";
import { MonsterData } from "../model/data/MonsterData";
import { ScenarioData } from "../model/data/ScenarioData";
import { Edition } from "../model/Edition";
import { Element } from "../model/Element";
import { Figure } from "../model/Figure";
import { Game, GameState } from "../model/Game";
import { Monster } from "../model/Monster";
import { MonsterEntity } from "../model/MonsterEntity";
import { Scenario } from "../model/Scenario";
import { AttackModifierManager } from "./AttackModifierManager";
import { CharacterManager } from "./CharacterManager";
import { MonsterManager } from "./MonsterManager";
import { StateManager } from "./StateManager";


export class GameManager {

  data: Data = defaultData;
  editionData: EditionData | undefined = undefined;
  game: Game = new Game();
  charactersData: CharacterData[] = [];
  monstersData: MonsterData[] = [];
  scenarioData: ScenarioData[] = [];
  stateManager: StateManager;
  characterManager: CharacterManager;
  monsterManager: MonsterManager;
  attackModifierManager: AttackModifierManager;
  working: boolean = false;

  constructor() {
    if (this.data && this.data.has(Edition.jotl)) {
      this.editionData = this.data.get(Edition.jotl);
      if (this.editionData) {
        this.charactersData = this.editionData.characters;
        this.monstersData = this.editionData.monsters;
        this.scenarioData = this.editionData.scenarios;
      }
    }
    this.stateManager = new StateManager(this.game);
    this.characterManager = new CharacterManager(this.game);
    this.monsterManager = new MonsterManager(this.game);
    this.attackModifierManager = new AttackModifierManager(this.game, this.editionData && this.editionData.attackModifiers || []);
  }

  editions(): string[] {
    return Array.from(this.data.keys()) as string[];
  }

  nextGameState(): void {
    this.working = true;
    if (this.game.state == GameState.next) {
      this.game.state = GameState.draw;
      this.game.round++;
      this.characterManager.draw();
      this.monsterManager.draw();
      this.attackModifierManager.draw();

      this.game.elements = [];
      this.game.strongElements.forEach((element: Element) => {
        this.game.elements.push(element);
      });
      this.game.strongElements = [];

      this.game.figures.sort((a: Figure, b: Figure) => {
        if (a instanceof CharacterEntity && b instanceof Monster) {
          return -1;
        } else if (a instanceof Monster && b instanceof CharacterEntity) {
          return 1;
        }
        return a.name < b.name ? -1 : 1;
      })

    } else if (this.nextAvailable()) {
      this.game.state = GameState.next;
      this.characterManager.next();
      this.monsterManager.next();
      this.attackModifierManager.next();

      this.game.newElements.forEach((element: Element) => {
        this.game.strongElements.push(element);
      });
      this.game.newElements = [];

      this.game.figures.sort((a: Figure, b: Figure) => {
        if (a instanceof CharacterEntity && a.exhausted) {
          return 99;
        }

        if (b instanceof CharacterEntity && b.exhausted) {
          return 99;
        }
        return a.getInitiative() - b.getInitiative();
      })
    }
    setTimeout(() => this.working = false, 1);
  }


  sortedFigures(): Figure[] {
    return this.game.figures.sort((a: Figure, b: Figure) => {
      if (this.game.state == GameState.draw) {
        if (a instanceof CharacterEntity && b instanceof Monster) {
          return -1;
        } else if (a instanceof Monster && b instanceof CharacterEntity) {
          return 1;
        }
        return a.name < b.name ? -1 : 1;
      }

      if (a instanceof CharacterEntity && a.exhausted) {
        return 99;
      }

      if (b instanceof CharacterEntity && b.exhausted) {
        return 99;
      }
      return a.getInitiative() - b.getInitiative();
    });
  }

  nextAvailable(): boolean {
    return this.game.figures.length > 0 && (this.game.state == GameState.next || this.game.figures.every((figure: Figure) => figure instanceof Monster || figure instanceof CharacterEntity && (figure.getInitiative() > 0 || figure.exhausted)
    ));
  }

  getCharacterData(name: String): CharacterData {
    if (!this.charactersData.some((value: CharacterData) => value.name == name)) {
      throw Error("unknown character: " + name);
    }

    return this.charactersData.filter((value: CharacterData) => value.name == name)[ 0 ];
  }

  isCharacter(figure: Figure): boolean {
    return figure instanceof CharacterEntity;
  }

  isMonster(figure: Figure): boolean {
    return figure instanceof Monster;
  }

  toCharacter(figure: Figure): CharacterEntity {
    return figure as CharacterEntity;
  }

  getMonsterData(name: String): MonsterData {
    if (!this.monstersData.some((value: MonsterData) => value.name == name)) {
      throw Error("unknown monster: " + name);
    }

    return this.monstersData.filter((value: MonsterData) => value.name == name)[ 0 ];
  }

  toMonster(figure: Figure): Monster {
    return figure as Monster;
  }

  toggleOff(figure: Figure) {
    const index = this.game.figures.indexOf(figure);

    if (index == -1) {
      figure.off = !figure.off;
    }

    if (figure.off) {
      for (let i = index; i < this.game.figures.length; i++) {
        this.game.figures[ i ].off = false;
      }
    } else {
      for (let i = 0; i <= index; i++) {
        this.game.figures[ i ].off = true;
      }
    }
  }

  toggleElement(element: Element) {
    if (this.game.state == GameState.draw) {
      if (this.game.newElements.indexOf(element) != -1) {
        this.game.newElements.splice(this.game.newElements.indexOf(element), 1);
        this.game.elements.push(element);
      } else if (this.game.elements.indexOf(element) != -1) {
        this.game.elements.splice(this.game.elements.indexOf(element), 1);
      } else {
        this.game.newElements.push(element);
      }
    } else {
      if (this.game.strongElements.indexOf(element) != -1) {
        this.game.strongElements.splice(this.game.strongElements.indexOf(element), 1);
        this.game.elements.push(element);
      } else if (this.game.elements.indexOf(element) != -1) {
        this.game.elements.splice(this.game.elements.indexOf(element), 1);
      } else {
        this.game.strongElements.push(element);
      }
    }
  }

  setLevel(level: number) {
    this.game.level = level;

    this.game.figures.forEach((figure: Figure) => {
      if (figure instanceof Monster) {
        figure.level = level;
        figure.entities.forEach((monsterEntity: MonsterEntity) => {
          monsterEntity.level = level
        })
      }
    })

  }

  szenarioLevel(): number {
    let charLevel = 0;
    let charCount = 0;

    this.game.figures.forEach((figure: Figure) => {
      if (figure instanceof CharacterEntity) {
        charLevel += figure.level;
        charCount += 1;
      }
    })

    if (charCount == 0) {
      return 0;
    }

    return Math.ceil(charLevel / charCount / 2);
  }

  setScenario(scenario: Scenario | undefined) {
    this.game.scenario = scenario;
    this.game.figures = this.game.figures.filter((figure: Figure) => figure instanceof CharacterData);
    if (scenario) {
      scenario.monsters.forEach((name: string) => {
        if (this.monstersData.some((monsterData: MonsterData) => monsterData.name == name && monsterData.edition == scenario.edition)) {
          this.monsterManager.addMonster(this.monstersData.filter((monsterData: MonsterData) => monsterData.name == name && monsterData.edition == scenario.edition)[ 0 ]);
        }
      });
    }
  }

}

export const gameManager: GameManager = new GameManager();