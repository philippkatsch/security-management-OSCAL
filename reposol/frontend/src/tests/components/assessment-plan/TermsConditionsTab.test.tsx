import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TermsConditionsTab } from '../../../components/assessment-plan/TermsConditionsTab';
import { AssessmentPlan } from '../../../lib/types/oscal';

describe('TermsConditionsTab', () => {
  const mockDispatch = vi.fn();

  const mockAP: AssessmentPlan = {
    uuid: 'ap-1',
    metadata: {
      title: 'Testing Plan',
      version: '1.0.0',
      'oscal-version': '1.2.2',
    },
    'import-ssp': {
      href: '../system-security-plans/00000000-0000-0000-0000-000000000001.json',
    },
    'reviewed-controls': {
      'control-selections': [{ 'include-all': {} }],
    },
    'terms-and-conditions': {
      parts: [
        {
          uuid: 'tc-1',
          name: 'rules-of-engagement',
          title: 'Rules of Engagement',
          prose: 'Testing must only be performed during off-peak hours (01:00-05:00 UTC).',
        },
        {
          uuid: 'tc-2',
          name: 'assessment-exclusions',
          title: 'Assessment Exclusions',
          prose: 'Denial of Service (DoS) testing is strictly prohibited.',
        },
      ],
    },
    'back-matter': {
      resources: [
        {
          uuid: 'res-1',
          title: 'Signed Rules of Engagement.pdf',
          description: 'Authorization document',
          rlinks: [{ href: '#res-1' }],
          base64: {
            filename: 'Signed Rules of Engagement.pdf',
            'media-type': 'application/pdf',
            value: 'JVBERi0xLjQK...',
          },
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders terms & conditions clauses and allows adding a canonical clause', () => {
    render(
      <TermsConditionsTab
        document={mockAP}
        dispatch={mockDispatch}
        isEditing={true}
      />
    );

    expect(screen.getAllByDisplayValue('Rules of Engagement').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByDisplayValue('Assessment Exclusions')).toBeInTheDocument();

    const proseTextarea = screen.getByPlaceholderText(/Enter clause provisions/i);
    const addClauseBtn = screen.getByRole('button', { name: /\+ Add Terms Clause/i });

    fireEvent.change(proseTextarea, { target: { value: 'Findings will be delivered via encrypted email.' } });
    fireEvent.click(addClauseBtn);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_TERMS_PART',
      })
    );
  });

  it('switches to Back-Matter Resource Attachments view and displays embedded files', () => {
    render(
      <TermsConditionsTab
        document={mockAP}
        dispatch={mockDispatch}
        isEditing={true}
      />
    );

    // Switch to attachments
    const attachmentsToggleBtn = screen.getByRole('button', { name: /Back-Matter Evidence & Attachments/i });
    fireEvent.click(attachmentsToggleBtn);

    expect(screen.getByText('Signed Rules of Engagement.pdf')).toBeInTheDocument();
    expect(screen.getByText('Authorization document')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download/i })).toBeInTheDocument();
  });
});
