import { Ability } from "../model/Ability";
import { Character } from "../model/Character";
import { CharacterData } from "../model/data/CharacterData";
import { DeckData } from "../model/data/DeckData";
import { EditionData } from "../model/data/EditionData";
import { MonsterData } from "../model/data/MonsterData";
import { ScenarioData } from "../model/data/ScenarioData";
import { Element } from "../model/Element";
import { FigureError } from "../model/FigureError";
import { Figure } from "../model/Figure";
import { Game, GameState } from "../model/Game";
import { Monster } from "../model/Monster";
import { MonsterEntity } from "../model/MonsterEntity";
import { MonsterStat } from "../model/MonsterStat";
import { MonsterType } from "../model/MonsterType";
import { Objective } from "../model/Objective";
import { Scenario } from "../model/Scenario";
import { AttackModifierManager } from "./AttackModifierManager";
import { CharacterManager } from "./CharacterManager";
import { MonsterManager } from "./MonsterManager";
import { settingsManager } from "./SettingsManager";
import { StateManager } from "./StateManager";
import { SectionData } from "../model/data/SectionData";
import { ObjectiveData } from "../model/data/ObjectiveData";
import { Entity, EntityValueFunction } from "../model/Entity";
import { Summon, SummonState } from "../model/Summon";
import { Condition, ConditionName, Conditions, ConditionType, EntityCondition, EntityConditionState } from "../model/Condition";
import { EntityManager } from "./EntityManager";


export class GameManager {

  game: Game = new Game();
  editionData: EditionData[] = [];
  stateManager: StateManager;
  entityManager: EntityManager;
  characterManager: CharacterManager;
  monsterManager: MonsterManager;
  attackModifierManager: AttackModifierManager;
  working: boolean = false;

  sessionTimestamp: number = 0;

  constructor() {
    this.stateManager = new StateManager(this.game);
    this.entityManager = new EntityManager(this.game);
    this.characterManager = new CharacterManager(this.game);
    this.monsterManager = new MonsterManager(this.game);
    this.attackModifierManager = new AttackModifierManager(this.game);
    this.sessionTimestamp = new Date().getTime();
  }

  editions(): string[] {
    return this.editionData.map((editionData: EditionData) => editionData.edition);
  }

  currentEditions(): string[] {
    if (!this.game.edition) {
      return this.editions();
    }

    return [ this.game.edition, ...this.editionExtensions(this.game.edition) ];
  }

  editionExtensions(edition: string): string[] {
    const editionData = this.editionData.find((editionData: EditionData) => editionData.edition == edition);
    return editionData && editionData.extentions || [];
  }

  charactersData(all: boolean = false): CharacterData[] {
    return this.editionData.filter((editionData: EditionData) => all || !this.game.edition || editionData.edition == this.game.edition || editionData.extentions && editionData.extentions.indexOf(this.game.edition) != -1).map((editionData: EditionData) => editionData.characters).flat();
  }

  monstersData(all: boolean = false): MonsterData[] {
    return this.editionData.filter((editionData: EditionData) => all || !this.game.edition || editionData.edition == this.game.edition || editionData.extentions && editionData.extentions.indexOf(this.game.edition) != -1).map((editionData: EditionData) => editionData.monsters).flat();
  }

  decksData(all: boolean = false): DeckData[] {
    return this.editionData.filter((editionData: EditionData) => all || !this.game.edition || editionData.edition == this.game.edition || editionData.extentions && editionData.extentions.indexOf(this.game.edition) != -1).map((editionData: EditionData) => editionData.decks).flat();
  }

  scenarioData(all: boolean = false): ScenarioData[] {
    return this.editionData.filter((editionData: EditionData) => all || !this.game.edition || editionData.edition == this.game.edition || editionData.extentions && editionData.extentions.indexOf(this.game.edition) != -1).map((editionData: EditionData) => editionData.scenarios).flat();
  }

  sectionData(all: boolean = false): SectionData[] {
    return this.editionData.filter((editionData: EditionData) => all || !this.game.edition || editionData.edition == this.game.edition || editionData.extentions && editionData.extentions.indexOf(this.game.edition) != -1).map((editionData: EditionData) => editionData.sections).flat();
  }

  conditions(all: boolean = false): Condition[] {
    if (all || !this.game.edition) {
      return Conditions;
    }

    const editionData = this.editionData.find((value: EditionData) => value.edition == this.game.edition);

    if (editionData && editionData.conditions) {
      return editionData.conditions.map((value: String) => {
        if (value.split(':').length > 1) {
          return new Condition(value.split(':')[ 0 ] as ConditionName, + value.split(':')[ 1 ]);
        } else {
          return new Condition(value as ConditionName);
        }
      })
    }

    return [];
  }

  conditionForTypes(...types: string[]) {
    return this.conditions(false).filter((condition: Condition) => types.every((type: string) => condition.types.indexOf(type as ConditionType) != -1));
  }

  allConditionForTypes(...types: string[]) {
    return this.conditions(true).filter((condition: Condition) => types.every((type: string) => condition.types.indexOf(type as ConditionType) != -1));
  }

  markers(): string[] {
    return this.game.figures.filter((figure: Figure) => figure instanceof Character && figure.marker).map((figure: Figure) => (figure as Character).edition + '-' + figure.name);
  }

  nextGameState(): void {
    this.working = true;
    this.game.playSeconds += (new Date().getTime() - this.sessionTimestamp) / 1000;
    this.game.totalSeconds += this.game.playSeconds;
    this.game.playSeconds = 0;
    if (this.game.state == GameState.next) {
      this.game.state = GameState.draw;
      this.characterManager.next();
      this.monsterManager.next();
      this.attackModifierManager.next();

      if (settingsManager.settings.moveElements) {
        this.game.elements = [];
        this.game.strongElements.forEach((element: Element) => {
          this.game.elements.push(element);
        });
        this.game.strongElements = [];
      }

      this.sortFigures();

      this.game.figures.forEach((figure: Figure) => figure.active = false);

    } else if (this.nextAvailable()) {
      this.game.state = GameState.next;
      this.game.round++;
      this.characterManager.draw();
      this.monsterManager.draw();
      this.attackModifierManager.draw();

      if (settingsManager.settings.moveElements) {
        this.game.newElements.forEach((element: Element) => {
          this.game.strongElements.push(element);
        });
        this.game.newElements = [];
      }

      this.sortFigures();

      if (this.game.figures.length > 0) {
        this.game.figures[ 0 ].active = true;
      }
    }
    setTimeout(() => this.working = false, 1);
  }

  sortFigures() {
    this.game.figures.sort((a: Figure, b: Figure) => {

      if (this.game.state == GameState.draw) {
        let aName = a.name.toLowerCase();
        if (a instanceof Character) {
          aName = a.title.toLowerCase() || settingsManager.getLabel('data.character.' + a.name).toLowerCase();
        } else if (a instanceof Monster) {
          aName = settingsManager.getLabel('data.monster.' + a.name).toLowerCase();
        } else if (a instanceof Objective) {
          aName = (a.title ? a.title : settingsManager.getLabel(a.name ? 'data.objective.' + a.name : (a.escort ? 'escort' : 'objective')).toLowerCase());
        }

        let bName = b.name.toLowerCase();
        if (b instanceof Character) {
          bName = b.title.toLowerCase() || settingsManager.getLabel('data.character.' + b.name).toLowerCase();
        } else if (b instanceof Monster) {
          bName = settingsManager.getLabel('data.monster.' + b.name).toLowerCase();
        } else if (b instanceof Objective) {
          bName = (b.title ? b.title : settingsManager.getLabel(b.name ? 'data.objective.' + b.name : (b.escort ? 'escort' : 'objective')).toLowerCase());
        }
        if (a instanceof Character && b instanceof Monster) {
          return -1;
        } else if (a instanceof Monster && b instanceof Character) {
          return 1;
        } else if (a instanceof Monster && b instanceof Monster && a.entities.length != b.entities.length) {
          return b.entities.length - a.entities.length;
        }
        return aName < bName ? -1 : 1;
      } else {
        return a.getInitiative() - b.getInitiative();
      }
    });
  }


  deckData(figure: MonsterData | CharacterData): DeckData {
    let deckData = this.decksData(true).find((deck: DeckData) => (deck.name == figure.deck || deck.name == figure.name) && deck.edition == figure.edition);

    // find extensions decks
    if (!deckData) {
      deckData = this.decksData(true).find((deck: DeckData) => (deck.name == figure.deck || deck.name == figure.name) && this.editionExtensions(figure.edition).indexOf(deck.edition) != -1);
    }

    if (!deckData) {
      console.error("Unknwon deck: " + figure.name + (figure.deck ? "[" + figure.deck + "]" : "") + " for " + figure.edition);
      if (figure.errors.indexOf(FigureError.deck) == -1) {
        figure.errors.push(FigureError.deck);
      }
      return new DeckData('', [], '');
    }

    return deckData;
  }

  abilities(figure: MonsterData | CharacterData): Ability[] {
    return this.deckData(figure).abilities;
  }

  nextAvailable(): boolean {
    return this.game.figures.length > 0 && (this.game.state == GameState.next || this.game.figures.every((figure: Figure) => figure instanceof Monster || figure instanceof Objective || figure instanceof Character && (figure.getInitiative() > 0 || figure.exhausted)
    ));
  }

  getCharacterData(name: string, edition: string): CharacterData {
    let characterData = this.charactersData(true).find((value: CharacterData) => value.name == name && value.edition == edition);
    if (!characterData) {
      console.error("unknown character: " + name);
      characterData = this.charactersData(true).find((value: CharacterData) => value.name == name);
      if (!characterData) {
        characterData = new CharacterData(name, [], "")
        characterData.errors.push(FigureError.unknown);
      }
      return characterData;
    }
    return characterData;
  }

  isCharacter(figure: Figure): boolean {
    return figure instanceof Character;
  }

  isObjective(figure: Figure): boolean {
    return figure instanceof Objective;
  }

  isMonster(figure: Figure): boolean {
    return figure instanceof Monster;
  }

  toCharacter(figure: Figure): Character {
    return figure as Character;
  }

  toObjective(figure: Figure): Objective {
    return figure as Objective;
  }

  toMonster(figure: Figure): Monster {
    return figure as Monster;
  }

  getEdition(figure: any): string {
    if (this.game.figures.some((value: any) => typeof (figure) == typeof (value) && figure.name == value.name && figure.edition != value.edition || this.game.edition && figure.edition != this.game.edition)) {
      return figure.edition;
    }
    return "";
  }

  getMonsterData(name: string, edition: string): MonsterData {
    let monsterData = this.monstersData(true).find((value: MonsterData) => value.name == name && value.edition == edition);
    if (!monsterData) {
      console.error("unknown monster '" + name + "' for edition '" + edition + "'");
      monsterData = this.monstersData(true).find((value: MonsterData) => value.name == name);
      if (!monsterData) {
        monsterData = new MonsterData(name, 0, new MonsterStat(MonsterType.normal, 0, 0, 0, 0, 0), [], "");
        monsterData.errors.push(FigureError.unknown);
      }
      return monsterData;
    }

    return monsterData;
  }

  toggleFigure(figure: Figure) {
    const figures: Figure[] = this.game.figures;
    const index = figures.indexOf(figure);

    if (index == -1) {
      console.error("Invalid figure");
      return;
    }

    if (!figure.active && !figure.off) {
      this.turn(figure);
    } else if (figure.active && !figure.off) {
      this.afterTurn(figure)
    } else {
      if (!figures.some((other: Figure, otherIndex: number) => otherIndex < index && other.active)) {
        figure.active = true;
      } else {
        this.beforeTurn(figure);
      }
    }

    for (let i = 0; i < figures.length; i++) {
      const otherFigure = figures[ i ];
      if (figure.active) {
        if (i != index) {
          otherFigure.active = false;
        }
        if (i < index) {
          this.afterTurn(otherFigure);
        } else if (!(otherFigure instanceof Monster) || (otherFigure instanceof Monster && otherFigure.entities.length > 0)) {
          this.beforeTurn(otherFigure);
        }
      }
      if (figure.off) {
        if (i < index && !otherFigure.off) {
          this.turn(otherFigure);
        } else if (i > index && (!(otherFigure instanceof Monster) || (otherFigure instanceof Monster && otherFigure.entities.length > 0))) {
          if (!otherFigure.off && i > index && !figures.some((figure: Figure, activeIndex: number) => figure.active && activeIndex < i)) {
            this.turn(otherFigure);
          } else {
            otherFigure.active = false;
          }
        }
      }
    }
  }


  beforeTurn(figure: Figure) {
    if (!this.permanentDead(figure)) {
      if (figure.off) {
        figure.off = false;
        if (settingsManager.settings.expireConditions) {
          if (figure instanceof Character) {
            this.entityManager.restoreConditions(figure);
            figure.summons.forEach((summon: Summon) => {
              this.entityManager.restoreConditions(summon);
            });
          } else if (figure instanceof Objective) {
            this.entityManager.restoreConditions(figure);
          } else if (figure instanceof Monster) {
            figure.entities.forEach((monsterEntity: MonsterEntity) => {
              this.entityManager.restoreConditions(monsterEntity);
            });
          }
        }
      }

      if (settingsManager.settings.applyConditions) {
        if (!figure.active) {
          if (figure instanceof Character) {
            this.entityManager.unapplyConditionsTurn(figure);
            figure.summons.forEach((summon: Summon) => {
              this.entityManager.unapplyConditionsTurn(summon);
            });
          } else if (figure instanceof Objective) {
            this.entityManager.unapplyConditionsTurn(figure);
          } else if (figure instanceof Monster) {
            figure.entities.forEach((monsterEntity: MonsterEntity) => {
              this.entityManager.unapplyConditionsTurn(monsterEntity);
            });
          }
        }
      }
    }

    if (settingsManager.settings.applyConditions) {
      if (figure instanceof Character) {
        this.entityManager.unapplyConditionsAfter(figure);
        figure.summons.forEach((summon: Summon) => {
          this.entityManager.unapplyConditionsAfter(summon);
        });
      } else if (figure instanceof Objective) {
        this.entityManager.unapplyConditionsAfter(figure);
      } else if (figure instanceof Monster) {
        figure.entities.forEach((monsterEntity: MonsterEntity) => {
          this.entityManager.unapplyConditionsAfter(monsterEntity);
        });
      }

      if (figure.off && !this.permanentDead(figure)) {
        figure.off = false;
      }
    }
  }

  turn(figure: Figure) {
    figure.active = true;
    if (settingsManager.settings.applyConditions) {
      if (figure instanceof Character) {
        this.entityManager.applyConditionsTurn(figure);
        figure.summons.forEach((summon: Summon) => {
          this.entityManager.applyConditionsTurn(summon);
        });
      } else if (figure instanceof Objective) {
        this.entityManager.applyConditionsTurn(figure);
      } else if (figure instanceof Monster) {
        figure.entities.forEach((monsterEntity: MonsterEntity) => {
          this.entityManager.applyConditionsTurn(monsterEntity);
        });
      }
    }
  }

  afterTurn(figure: Figure) {
    if (!figure.off) {
      figure.off = true;
      figure.active = false;
      if (settingsManager.settings.expireConditions) {
        if (figure instanceof Character) {
          this.entityManager.expireConditions(figure);
          figure.summons.forEach((summon: Summon) => {
            this.entityManager.expireConditions(summon);
          });
        } else if (figure instanceof Objective) {
          this.entityManager.expireConditions(figure);
        } else if (figure instanceof Monster) {
          figure.entities.forEach((monsterEntity: MonsterEntity) => {
            this.entityManager.expireConditions(monsterEntity);
          });
        }
      }

      if (settingsManager.settings.applyConditions) {
        if (figure instanceof Character) {
          this.entityManager.applyConditionsTurn(figure);
          figure.summons.forEach((summon: Summon) => {
            this.entityManager.applyConditionsTurn(summon);
          });
        } else if (figure instanceof Objective) {
          this.entityManager.applyConditionsTurn(figure);
        } else if (figure instanceof Monster) {
          figure.entities.forEach((monsterEntity: MonsterEntity) => {
            this.entityManager.applyConditionsTurn(monsterEntity);
          });
        }

        if (figure instanceof Character) {
          this.entityManager.applyConditionsAfter(figure);
          figure.summons.forEach((summon: Summon) => {
            this.entityManager.applyConditionsAfter(summon);
          });
        } else if (figure instanceof Objective) {
          this.entityManager.applyConditionsAfter(figure);
        } else if (figure instanceof Monster) {
          figure.entities.forEach((monsterEntity: MonsterEntity) => {
            this.entityManager.applyConditionsAfter(monsterEntity);
          });
        }
      }

      if (figure instanceof Character) {
        for (let summon of figure.summons) {
          if (summon.state == SummonState.new) {
            summon.state = SummonState.true;
          }
        }
      } else if (figure instanceof Monster) {
        figure.entities.forEach((monsterEntity: MonsterEntity) => {
          if (monsterEntity.summon == SummonState.new) {
            monsterEntity.summon = SummonState.true;
          }
        })
      }
    }
  }

  permanentDead(figure: Figure): boolean {
    return ((figure instanceof Character || figure instanceof Objective) && (figure.exhausted || figure.health == 0)) || figure instanceof Monster && figure.entities.every((monsterEntity: MonsterEntity) => monsterEntity.dead || monsterEntity.health == 0);
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
      if (figure instanceof Character) {
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
    if (scenario && !scenario.custom) {
      const editionData: EditionData | undefined = this.editionData.find((value: EditionData) => value.edition == scenario.edition);
      if (!editionData) {
        console.error("Could not find edition data!");
        return;
      }
      this.resetRound();
      this.applyScenarioData(editionData, scenario);
    }
  }

  resetRound() {
    this.sessionTimestamp = new Date().getTime();
    this.game.playSeconds = 0;
    this.game.sections = [];
    this.game.round = 0;
    this.game.state = GameState.draw;
    this.game.figures = this.game.figures.filter((figure: Figure) => figure instanceof Character);
    this.game.figures.forEach((figure: Figure) => {
      if (figure instanceof Character) {
        figure.health = figure.maxHealth;
        figure.loot = 0;
        figure.experience = 0;
        figure.entityConditions = [];
        figure.summons = [];
        figure.initiative = 0;
        figure.active = false;
        figure.off = false;
        figure.exhausted = false;
      }
    })
  }

  addSection(section: SectionData) {
    const editionData: EditionData | undefined = this.editionData.find((value: EditionData) => value.edition == section.edition);
    if (!editionData) {
      console.error("Could not find edition data!");
      return;
    }

    if (!this.game.sections.some((value: SectionData) => value.edition == section.edition && value.index == section.index)) {
      this.game.sections.push(section);
      this.applyScenarioData(editionData, section);
    }
  }

  applyScenarioData(editionData: EditionData, scenarioData: ScenarioData) {
    if (scenarioData.monsters) {
      scenarioData.monsters.forEach((name: string) => {
        const monsterData = this.monstersData(true).find((monsterData: MonsterData) => monsterData.name == name && (monsterData.edition == editionData.edition || editionData.extentions && editionData.extentions.indexOf(monsterData.edition) != -1));
        if (monsterData) {
          this.monsterManager.addMonster(monsterData);
        }
      });
    }

    if (scenarioData.objectives) {
      scenarioData.objectives.forEach((objectiveData: ObjectiveData) => {
        this.characterManager.addObjective(objectiveData)
      })
    }
  }

}

export const gameManager: GameManager = new GameManager();