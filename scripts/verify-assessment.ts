import assert from 'node:assert/strict';
import { assessmentQuestions, isAssessmentComplete, scoreAssessment } from '../src/data/assessment';

const answers = Object.fromEntries(assessmentQuestions.map((question) => [question.id, question.correctIndex]));
assert.equal(isAssessmentComplete(answers), true);
assert.equal(isAssessmentComplete({ ...answers, [assessmentQuestions.at(-1)!.id]: undefined as unknown as number }), false);
assert.equal(isAssessmentComplete({ ...answers, [assessmentQuestions[0].id]: 4 }), false);
assert.equal(scoreAssessment(answers).level, 'C2');
console.log('Assessment completion and scoring verification passed.');
