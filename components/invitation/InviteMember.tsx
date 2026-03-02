import React from 'react';
import { useTranslation } from 'next-i18next';

import Modal from '../shared/Modal';
import type { Project } from '@prisma/client';
import InviteViaEmail from './InviteViaEmail';
import InviteViaLink from './InviteViaLink';

interface InviteMemberProps {
  project: Project;
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

const InviteMember = ({ visible, setVisible, project }: InviteMemberProps) => {
  const { t } = useTranslation('common');

  return (
    <Modal open={visible} close={() => setVisible(!visible)}>
      <Modal.Header>{t('invite-new-member')}</Modal.Header>
      <Modal.Body>
        <div className="grid grid-cols-1 divide-y py-2">
          <InviteViaEmail setVisible={setVisible} project={project} />
          <InviteViaLink project={project} />
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default InviteMember;
