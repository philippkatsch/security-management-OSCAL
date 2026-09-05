import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import {
  hasTaskCycle,
  addTask,
  addTaskDependency,
  removeTaskDependency,
  setTaskTiming,
  addLocalObjective,
  addLocalActivity,
  addTermsPart,
  removeTermsPart,
  updateTermsPart,
} from '../../lib/document-actions/assessment-plan-actions';
import {
  Task,
  AssessmentPlan,
  TermsPartNameEnum,
  AssessmentMethodEnum
} from '../../lib/types/oscal';

function makeAP(tasks: Task[] = []): { 'assessment-plan': AssessmentPlan } {
  return {
    'assessment-plan': {
      uuid: 'ap-challenger-adv-001',
      metadata: {
        title: 'Adversarial Test AP',
        version: '1.0.0',
        'oscal-version': '1.2.2',
        'last-modified': new Date().toISOString()
      },
      'import-ssp': {
        href: '#target-ssp'
      },
      'reviewed-controls': {
        'control-selections': [{ 'include-all': {} }]
      },
      tasks
    }
  };
}

describe('Challenger Adversarial - Task DAG Cycle Detection & Timing Variants', () => {
  describe('1. hasTaskCycle topological stress tests', () => {
    it('detects self-loop immediately (from === to)', () => {
      const tasks: Task[] = [{ uuid: 'task-a', title: 'Task A', type: 'action' }];
      expect(hasTaskCycle(tasks, 'task-a', 'task-a')).toBe(true);
    });

    it('detects 2-node cycle (A depends on B, attempting B depends on A)', () => {
      const tasks: Task[] = [
        {
          uuid: 'task-a',
          title: 'Task A',
          type: 'action',
          dependencies: [{ 'task-uuid': 'task-b' }]
        },
        {
          uuid: 'task-b',
          title: 'Task B',
          type: 'action'
        }
      ];
      // task-a already depends on task-b.
      // Proposing task-b depends on task-a forms cycle:
      expect(hasTaskCycle(tasks, 'task-b', 'task-a')).toBe(true);
      // But proposing task-b depends on task-c does not:
      expect(hasTaskCycle(tasks, 'task-b', 'task-c')).toBe(false);
    });

    it('detects 3-node transitive cycle (A -> B -> C -> A)', () => {
      const tasks: Task[] = [
        {
          uuid: 'task-a',
          title: 'Task A',
          type: 'action',
          dependencies: [{ 'task-uuid': 'task-b' }]
        },
        {
          uuid: 'task-b',
          title: 'Task B',
          type: 'action',
          dependencies: [{ 'task-uuid': 'task-c' }]
        },
        {
          uuid: 'task-c',
          title: 'Task C',
          type: 'action'
        }
      ];
      // task-a -> task-b -> task-c. Proposing task-c depends on task-a:
      expect(hasTaskCycle(tasks, 'task-c', 'task-a')).toBe(true);
    });

    it('handles diamond DAG without false positive', () => {
      // Diamond: D depends on B and C; B depends on A; C depends on A.
      // All paths point backwards to A.
      const tasks: Task[] = [
        { uuid: 'task-a', title: 'Task A', type: 'action' },
        { uuid: 'task-b', title: 'Task B', type: 'action', dependencies: [{ 'task-uuid': 'task-a' }] },
        { uuid: 'task-c', title: 'Task C', type: 'action', dependencies: [{ 'task-uuid': 'task-a' }] },
        {
          uuid: 'task-d',
          title: 'Task D',
          type: 'action',
          dependencies: [{ 'task-uuid': 'task-b' }, { 'task-uuid': 'task-c' }]
        }
      ];
      // Adding B -> C is acyclic (A -> B -> C -> D)
      expect(hasTaskCycle(tasks, 'task-b', 'task-c')).toBe(false);
      // But adding A -> D creates cycle (A -> D -> B -> A)
      expect(hasTaskCycle(tasks, 'task-a', 'task-d')).toBe(true);
    });

    it('scales to 50-node ring cycle without stack overflow', () => {
      const count = 50;
      const tasks: Task[] = [];
      for (let i = 0; i < count; i++) {
        tasks.push({
          uuid: `task-${i}`,
          title: `Task ${i}`,
          type: 'action',
          dependencies: i > 0 ? [{ 'task-uuid': `task-${i - 1}` }] : []
        });
      }
      // Linear chain: task-49 depends on task-48 ... depends on task-0.
      // Adding dependency from task-0 to task-49 would complete the ring:
      expect(hasTaskCycle(tasks, 'task-0', 'task-49')).toBe(true);
      // Valid addition to an external node:
      expect(hasTaskCycle(tasks, 'task-0', 'task-external')).toBe(false);
    });

    it('detects cycle in disconnected subgraphs', () => {
      const tasks: Task[] = [
        // Subgraph 1: clean linear
        { uuid: 't1', title: 'T1', type: 'action' },
        { uuid: 't2', title: 'T2', type: 'action', dependencies: [{ 'task-uuid': 't1' }] },
        // Subgraph 2: t3 -> t4
        { uuid: 't3', title: 'T3', type: 'action', dependencies: [{ 'task-uuid': 't4' }] },
        { uuid: 't4', title: 'T4', type: 'action' }
      ];
      // Proposing t4 depends on t3 creates cycle in subgraph 2:
      expect(hasTaskCycle(tasks, 't4', 't3')).toBe(true);
      // Connecting subgraph 1 to subgraph 2 is valid:
      expect(hasTaskCycle(tasks, 't1', 't4')).toBe(false);
    });
  });

  describe('2. addTaskDependency action enforcement', () => {
    it('throws error when adding self dependency', () => {
      const state = makeAP([{ uuid: 't-self', title: 'Self', type: 'action' }]);
      expect(() => {
        produce(state, addTaskDependency('t-self', 't-self').apply);
      }).toThrow(/cannot depend on itself/i);
    });

    it('throws error when adding circular dependency', () => {
      const state = makeAP([
        { uuid: 't-1', title: 'T1', type: 'action', dependencies: [{ 'task-uuid': 't-2' }] },
        { uuid: 't-2', title: 'T2', type: 'action' }
      ]);
      expect(() => {
        produce(state, addTaskDependency('t-2', 't-1').apply);
      }).toThrow(/circular dependency detected/i);
    });

    it('successfully adds and removes valid task dependency', () => {
      const state = makeAP([
        { uuid: 't-1', title: 'T1', type: 'action' },
        { uuid: 't-2', title: 'T2', type: 'action' }
      ]);
      const withDep = produce(state, addTaskDependency('t-2', 't-1', 'Must finish first').apply);
      const t2 = withDep['assessment-plan'].tasks?.find(t => t.uuid === 't-2');
      expect(t2?.dependencies).toHaveLength(1);
      expect(t2?.dependencies?.[0]['task-uuid']).toBe('t-1');
      expect(t2?.dependencies?.[0].remarks).toBe('Must finish first');

      const withoutDep = produce(withDep, removeTaskDependency('t-2', 't-1').apply);
      const t2Clean = withoutDep['assessment-plan'].tasks?.find(t => t.uuid === 't-2');
      expect(t2Clean?.dependencies).toHaveLength(0);
    });
  });

  describe('3. Task Timing Variants (on-date, within-date-range, at-frequency)', () => {
    it('applies on-date timing', () => {
      const state = makeAP([{ uuid: 't-timing', title: 'Timing Task', type: 'milestone' }]);
      const next = produce(state, setTaskTiming('t-timing', {
        'on-date': { date: '2026-10-15T09:00:00Z', remarks: 'Kickoff milestone' }
      }).apply);

      const task = next['assessment-plan'].tasks?.find(t => t.uuid === 't-timing');
      expect(task?.timing?.['on-date']?.date).toBe('2026-10-15T09:00:00Z');
      expect(task?.timing?.['on-date']?.remarks).toBe('Kickoff milestone');
      expect(task?.timing?.['within-date-range']).toBeUndefined();
      expect(task?.timing?.['at-frequency']).toBeUndefined();
    });

    it('applies within-date-range timing', () => {
      const state = makeAP([{ uuid: 't-timing', title: 'Timing Task', type: 'action' }]);
      const next = produce(state, setTaskTiming('t-timing', {
        'within-date-range': {
          start: '2026-10-01T08:00:00Z',
          end: '2026-10-10T17:00:00Z',
          remarks: 'Assessment execution window'
        }
      }).apply);

      const task = next['assessment-plan'].tasks?.find(t => t.uuid === 't-timing');
      expect(task?.timing?.['within-date-range']?.start).toBe('2026-10-01T08:00:00Z');
      expect(task?.timing?.['within-date-range']?.end).toBe('2026-10-10T17:00:00Z');
      expect(task?.timing?.['on-date']).toBeUndefined();
    });

    it('applies at-frequency timing across valid time units', () => {
      const units: Array<'seconds' | 'minutes' | 'hours' | 'days' | 'months' | 'years'> = [
        'seconds', 'minutes', 'hours', 'days', 'months', 'years'
      ];

      for (const unit of units) {
        const state = makeAP([{ uuid: 't-periodic', title: 'Periodic', type: 'action' }]);
        const next = produce(state, setTaskTiming('t-periodic', {
          'at-frequency': { period: 7, unit, remarks: `Runs every 7 ${unit}` }
        }).apply);

        const task = next['assessment-plan'].tasks?.find(t => t.uuid === 't-periodic');
        expect(task?.timing?.['at-frequency']?.period).toBe(7);
        expect(task?.timing?.['at-frequency']?.unit).toBe(unit);
      }
    });
  });

  describe('4. Evaluation Method Enums and 7 Canonical Terms Parts', () => {
    it('supports INTERVIEW, EXAMINE, TEST evaluation methods in objectives and activities', () => {
      const methods: AssessmentMethodEnum[] = ['INTERVIEW', 'EXAMINE', 'TEST'];
      let state = makeAP();

      for (const method of methods) {
        // Add local objective with method
        state = produce(state, addLocalObjective({
          'control-id': `ac-${method.toLowerCase()}`,
          description: `Objective for ${method}`,
          parts: [
            {
              name: 'assessment-method',
              props: [{ name: 'method', value: method }]
            }
          ]
        }).apply);

        // Add local activity with method prop
        state = produce(state, addLocalActivity({
          uuid: `act-${method.toLowerCase()}`,
          title: `Activity for ${method}`,
          description: `Executing ${method} procedure`,
          props: [{ name: 'method', value: method }]
        }).apply);
      }

      const ap = state['assessment-plan'];
      expect(ap['local-definitions']?.['objectives-and-methods']).toHaveLength(3);
      expect(ap['local-definitions']?.activities).toHaveLength(3);

      methods.forEach((method, idx) => {
        const obj = ap['local-definitions']?.['objectives-and-methods']?.[idx];
        const act = ap['local-definitions']?.activities?.[idx];
        expect(obj?.parts?.[0]?.props?.[0]?.value).toBe(method);
        expect(act?.props?.[0]?.value).toBe(method);
      });
    });

    it('populates and manages all 7 canonical terms and conditions clauses', () => {
      const canonicalNames: TermsPartNameEnum[] = [
        'rules-of-engagement',
        'disclosures',
        'assessment-inclusions',
        'assessment-exclusions',
        'results-delivery',
        'assumptions',
        'methodology'
      ];

      let state = makeAP();

      // Add all 7 canonical parts
      for (const name of canonicalNames) {
        state = produce(state, addTermsPart({
          uuid: `term-${name}`,
          name,
          title: `Clause: ${name}`,
          prose: `Standard terms regarding ${name}`
        }).apply);
      }

      expect(state['assessment-plan']['terms-and-conditions']?.parts).toHaveLength(7);

      // Verify each part name is present and matches canonical enum
      const parts = state['assessment-plan']['terms-and-conditions']?.parts || [];
      canonicalNames.forEach(name => {
        const found = parts.find(p => p.name === name);
        expect(found).toBeDefined();
        expect(found?.title).toBe(`Clause: ${name}`);
      });

      // Update one part
      state = produce(state, updateTermsPart('term-rules-of-engagement', {
        prose: 'Updated RoE: Testing between 09:00 and 17:00 UTC only.'
      }).apply);
      const updated = state['assessment-plan']['terms-and-conditions']?.parts?.find(
        p => p.name === 'rules-of-engagement'
      );
      expect(updated?.prose).toBe('Updated RoE: Testing between 09:00 and 17:00 UTC only.');

      // Remove one part
      state = produce(state, removeTermsPart('term-methodology').apply);
      expect(state['assessment-plan']['terms-and-conditions']?.parts).toHaveLength(6);
      expect(state['assessment-plan']['terms-and-conditions']?.parts?.some(p => p.name === 'methodology')).toBe(false);
    });
  });
});
