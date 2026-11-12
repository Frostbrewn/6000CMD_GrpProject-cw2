// password-meter.js — live strength meter and rule checklist for password fields.
// Guidance only; the server enforces the real password policy.
import { passwordStrength, passwordProblems } from './validation.js';

const LABELS = ['—', 'Weak', 'Fair', 'Good', 'Strong'];

export function attachPasswordMeter({ input, meter, label, rules, getEmail = () => '' }) {
  const update = () => {
    const pw = input.value;
    const score = pw ? passwordStrength(pw) : 0;
    meter.dataset.score = String(score);
    label.textContent = `Strength: ${pw ? LABELS[score] : '—'}`;
    if (rules) {
      const problems = pw ? passwordProblems(pw, { email: getEmail() }) : ['length', 'common', 'personal'];
      rules.querySelectorAll('li[data-rule]').forEach((li) => {
        li.classList.toggle('ok', Boolean(pw) && !problems.includes(li.dataset.rule));
      });
    }
  };
  input.addEventListener('input', update);
  update();
  return update;
}
