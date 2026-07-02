import { IsIn } from 'class-validator';
import { FOLLOW_UP_ANSWER_OPTIONS, type FollowUpAnswer } from '@earlysteps/shared-types';

/** The caregiver's structured answer to a confirmation follow-up — closed choice only. */
export class AnswerFollowUpDto {
  @IsIn([...FOLLOW_UP_ANSWER_OPTIONS])
  answer!: FollowUpAnswer;
}
