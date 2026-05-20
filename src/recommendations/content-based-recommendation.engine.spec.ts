import { Difficulty } from '@prisma/client';
import {
  ContentBasedRecommendationEngine,
  ScoringAttempt,
  ScoringTagMastery,
  ScoringTest,
} from './content-based-recommendation.engine';

const tags = {
  oop: { id: 'tag-oop', name: 'oop' },
  sql: { id: 'tag-sql', name: 'sql' },
  arrays: { id: 'tag-arrays', name: 'arrays' },
};

const createTest = (overrides: Partial<ScoringTest>): ScoringTest => ({
  id: 'test-id',
  title: 'Test',
  categoryId: 'programming',
  categoryName: 'Programming',
  difficulty: Difficulty.INTERMEDIATE,
  averageRating: 4,
  tags: [],
  ...overrides,
});

const createAttempt = (
  overrides: Partial<ScoringAttempt>,
): ScoringAttempt => ({
  testId: 'attempted-test',
  score: 70,
  maxScore: 100,
  isPassed: true,
  test: {
    categoryId: 'programming',
    difficulty: Difficulty.INTERMEDIATE,
  },
  ...overrides,
});

const createMastery = (
  overrides: Partial<ScoringTagMastery>,
): ScoringTagMastery => ({
  attemptsCount: 5,
  masteryScore: 0.2,
  tag: tags.oop,
  ...overrides,
});

describe('ContentBasedRecommendationEngine', () => {
  let engine: ContentBasedRecommendationEngine;

  beforeEach(() => {
    engine = new ContentBasedRecommendationEngine();
  });

  it('ranks tests matching weak user tags higher', () => {
    const matchingTest = createTest({
      id: 'oop-practice',
      title: 'OOP Practice',
      tags: [tags.oop],
    });
    const unrelatedTest = createTest({
      id: 'array-practice',
      title: 'Array Practice',
      tags: [tags.arrays],
    });

    const [first, second] = engine.scoreTests(
      [unrelatedTest, matchingTest],
      [createMastery({ tag: tags.oop })],
      [createAttempt({})],
    );

    expect(first.test.id).toBe('oop-practice');
    expect(first.score).toBeGreaterThan(second.score);
    expect(first.matchedTags).toEqual(['oop']);
    expect(first.recommendationType).toBe('knowledge_gap');
  });

  it('penalizes tests the user has already passed', () => {
    const alreadyPassedTest = createTest({
      id: 'already-passed',
      tags: [tags.oop],
    });
    const freshTest = createTest({
      id: 'fresh-test',
      tags: [tags.oop],
    });

    const [first, second] = engine.scoreTests(
      [alreadyPassedTest, freshTest],
      [createMastery({ tag: tags.oop })],
      [
        createAttempt({
          testId: 'already-passed',
          isPassed: true,
        }),
      ],
    );

    expect(first.test.id).toBe('fresh-test');
    expect(first.score).toBeGreaterThan(second.score);
  });

  it('prefers a higher difficulty after strong average performance', () => {
    const intermediateTest = createTest({
      id: 'intermediate-review',
      difficulty: Difficulty.INTERMEDIATE,
    });
    const advancedTest = createTest({
      id: 'advanced-next',
      difficulty: Difficulty.ADVANCED,
    });

    const [first, second] = engine.scoreTests(
      [intermediateTest, advancedTest],
      [],
      [
        createAttempt({
          score: 92,
          maxScore: 100,
          test: {
            categoryId: 'programming',
            difficulty: Difficulty.INTERMEDIATE,
          },
        }),
      ],
    );

    expect(first.test.id).toBe('advanced-next');
    expect(first.score).toBeGreaterThan(second.score);
  });

  it('prefers simpler difficulty after weak average performance', () => {
    const beginnerTest = createTest({
      id: 'beginner-remediation',
      difficulty: Difficulty.BEGINNER,
    });
    const advancedTest = createTest({
      id: 'advanced-too-soon',
      difficulty: Difficulty.ADVANCED,
    });

    const [first, second] = engine.scoreTests(
      [advancedTest, beginnerTest],
      [],
      [
        createAttempt({
          score: 45,
          maxScore: 100,
          test: {
            categoryId: 'programming',
            difficulty: Difficulty.INTERMEDIATE,
          },
        }),
      ],
    );

    expect(first.test.id).toBe('beginner-remediation');
    expect(first.score).toBeGreaterThan(second.score);
  });

  it('handles cold start by preferring beginner and rated tests', () => {
    const beginnerPopularTest = createTest({
      id: 'beginner-popular',
      difficulty: Difficulty.BEGINNER,
      averageRating: 5,
    });
    const advancedUnratedTest = createTest({
      id: 'advanced-unrated',
      difficulty: Difficulty.ADVANCED,
      averageRating: 0,
    });

    const [first, second] = engine.scoreTests(
      [advancedUnratedTest, beginnerPopularTest],
      [],
      [],
    );

    expect(first.test.id).toBe('beginner-popular');
    expect(first.score).toBeGreaterThan(second.score);
    expect(first.recommendationType).toBe('popular');
  });
});
