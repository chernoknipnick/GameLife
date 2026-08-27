import { useEffect, useRef, useState } from 'react';
import {
  DIFFICULTY,
  MAX_NAME_LENGTH,
  MAX_STARTER_HABITS,
  MIN_STARTER_HABITS,
  STATS,
  TEMPLATES,
} from '../state/rules.js';
import { CheckIcon } from './icons.jsx';

/* Знакомство из трёх шагов (FR-1.1 — FR-1.4). Показывается только тому,
   у кого нет сохранения, и повторно после сброса прогресса. Отдельного
   флага в состоянии нет намеренно: раздел 6.1 его не описывает, а
   признак «нет сохранения» решает ту же задачу. */

const FACTS = [
  { value: '+25', stat: 'strength', label: 'опыта за среднюю привычку' },
  { value: '×1.5', stat: 'intellect', label: 'множитель за серию в 30 дней' },
  { value: '0', stat: 'health', label: 'наказаний за пропуск' },
];

export default function Onboarding({ onFinish, onNotice }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState([]);

  const nameRef = useRef(null);
  const firstTemplateRef = useRef(null);

  useEffect(() => {
    if (step === 1) nameRef.current?.focus();
    else if (step === 2) firstTemplateRef.current?.focus();
  }, [step]);

  function toggle(index) {
    if (picked.indexOf(index) < 0 && picked.length >= MAX_STARTER_HABITS) {
      onNotice('Для начала хватит ' + MAX_STARTER_HABITS + ' привычек — остальные добавите позже');
      return;
    }

    /* Обновление считается от предыдущего значения, а не от замыкания:
       несколько нажатий в одном такте видят одно и то же picked, и
       каждое затирало бы предыдущее. */
    setPicked((prev) => {
      if (prev.indexOf(index) >= 0) return prev.filter((item) => item !== index);
      if (prev.length >= MAX_STARTER_HABITS) return prev;
      return [...prev, index];
    });
  }

  const enough = picked.length >= MIN_STARTER_HABITS && picked.length <= MAX_STARTER_HABITS;

  return (
    <section className="onboarding">
      <div className="onboarding__inner">
        <div className="onboarding__steps" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              className={'onboarding__step' + (index <= step ? ' onboarding__step--done' : '')}
              key={index}
            />
          ))}
        </div>

        <div className="onboarding__panel" hidden={step !== 0}>
          <span className="onboarding__mark" aria-hidden="true" />
          <h1 className="onboarding__title">Реальные дела — игровой прогресс</h1>
          <p className="onboarding__text">
            Каждое выполненное дело даёт опыт персонажу и качает характеристику. Пропуск дня ничего
            не отнимает.
          </p>

          <ul className="facts">
            {FACTS.map((fact) => (
              <li className="fact" key={fact.label}>
                <span className={'fact__value fact__value--' + fact.stat}>{fact.value}</span>
                <span className="fact__label">{fact.label}</span>
              </li>
            ))}
          </ul>

          <div className="onboarding__actions">
            <button className="btn btn--primary" type="button" onClick={() => setStep(1)}>
              Начать
            </button>
            {/* FR-1.4: выйти можно на первом же экране, без выбора привычек. */}
            <button
              className="btn btn--quiet"
              type="button"
              onClick={() => onFinish({ name: '', indexes: [] })}
            >
              Пропустить
            </button>
          </div>
        </div>

        <div className="onboarding__panel" hidden={step !== 1}>
          <h2 className="onboarding__title">Имя персонажа</h2>
          <p className="onboarding__text">Можно изменить позже.</p>

          <label className="visually-hidden" htmlFor="onb-name">
            Имя персонажа
          </label>
          <input
            className="field__input"
            id="onb-name"
            type="text"
            maxLength={MAX_NAME_LENGTH}
            autoComplete="off"
            placeholder="Герой"
            ref={nameRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && setStep(2)}
          />

          <div className="onboarding__actions onboarding__actions--row">
            <button className="btn btn--ghost" type="button" onClick={() => setStep(0)}>
              Назад
            </button>
            <button className="btn btn--primary" type="button" onClick={() => setStep(2)}>
              Далее
            </button>
          </div>
        </div>

        <div className="onboarding__panel" hidden={step !== 2}>
          <h2 className="onboarding__title">Стартовые привычки</h2>
          <p className="onboarding__text">
            {enough
              ? 'Выбрано ' + picked.length + '. Остальное добавите позже.'
              : 'Выберите от ' +
                MIN_STARTER_HABITS +
                ' до ' +
                MAX_STARTER_HABITS +
                ' — остальное добавите позже.'}
          </p>

          <div className="templates" role="group" aria-label="Шаблоны привычек">
            {TEMPLATES.map((template, index) => (
              <button
                type="button"
                className="template"
                aria-pressed={picked.indexOf(index) >= 0}
                key={template.title}
                ref={index === 0 ? firstTemplateRef : undefined}
                onClick={() => toggle(index)}
              >
                <span className="template__box">
                  <CheckIcon />
                </span>
                <span className="template__body">
                  <span className="template__title">{template.title}</span>
                  <span className="template__meta">
                    {DIFFICULTY[template.difficulty].label} · +{DIFFICULTY[template.difficulty].xp}{' '}
                    опыта
                  </span>
                </span>
                <span className={'template__stat chip chip--' + template.stat}>
                  {STATS[template.stat].abbr}
                </span>
              </button>
            ))}
          </div>

          <div className="onboarding__actions onboarding__actions--row">
            <button className="btn btn--ghost" type="button" onClick={() => setStep(1)}>
              Назад
            </button>
            <button
              className="btn btn--primary"
              type="button"
              disabled={!enough}
              onClick={() => onFinish({ name, indexes: picked })}
            >
              Создать персонажа
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
