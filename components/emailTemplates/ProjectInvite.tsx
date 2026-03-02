import {
  Button,
  Container,
  Head,
  Html,
  Preview,
  Text,
} from '@react-email/components';
import EmailLayout from './EmailLayout';
import app from '@/lib/app';

interface ProjectInviteEmailProps {
  project: { name: string };
  invitationLink: string;
  subject: string;
}

const ProjectInviteEmail = ({
  project,
  invitationLink,
  subject,
}: ProjectInviteEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <EmailLayout>
        <Text>
          You have been invited to join the {project.name} project on {app.name}
          .
        </Text>
        <Text>
          Click the button below to accept the invitation and join the project.
        </Text>
        <Container className="text-center">
          <Button
            href={invitationLink}
            className="bg-brand text-white font-medium py-2 px-4 rounded"
          >
            Join the project
          </Button>
        </Container>
        <Text>
          You have 7 days to accept this invitation before it expires.
        </Text>
      </EmailLayout>
    </Html>
  );
};

export default ProjectInviteEmail;
